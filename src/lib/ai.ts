// ─── AsisBot · Motor Gemini (OPCIONAL) ───────────────────────────────────────
// Este es solo UNO de los motores que puede usar el agente de AsisBot
// (ver src/lib/agent.ts). El motor por defecto es el agente propio de
// reglas, que no necesita clave ni llamadas externas. Gemini solo se usa
// si AI_ENGINE=gemini y hay clave configurada.
//
// La verificación facial sigue siendo SIMULADA (ver attendance.ts): las
// selfies de la demo son ilustraciones, no fotos reales, así que ninguna IA
// puede comparar rostros con ellas. Lo que un motor hace aquí:
//
//   1. Explicar en lenguaje claro por qué una marcación quedó en revisión
//      (qué alertas, qué significan, qué debe mirar el supervisor).
//   2. Sugerir la acción recomendada para RR.HH.
//
// Configuración (.env):
//   GEMINI_API_KEY=...   clave gratuita de Google AI Studio (aistudio.google.com)
//   GEMINI_MODEL=...     opcional; por defecto gemini-3-flash-preview
//
// La clave solo se lee del entorno en el servidor. Nunca va en el código
// ni llega al navegador.

import type { AlertDraft, CheckStatus, CheckType } from "./attendance";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Modelos a probar en orden: el configurado primero y luego los alias
// estables. (Algunas versiones 2.5 dejaron de estar disponibles para
// cuentas nuevas; los alias -latest y la serie 3.x siguen activos.)
const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-flash-latest",
].filter((m): m is string => Boolean(m));

export type AnalysisSource = "propio" | "gemini";

export interface CheckInAnalysisInput {
  workerName: string;
  type: CheckType;
  status: CheckStatus;
  reason: string;
  alerts: AlertDraft[];
  distanceM: number | null;
  similarity: number | null;
  zoneName: string | null;
  scheduleStart: string;
}

export interface CheckInAnalysis {
  source: AnalysisSource;
  /** Explicación en lenguaje claro para el supervisor (2-3 frases). */
  explanation: string;
  /** Acción recomendada para RR.HH. (una frase). */
  suggestion: string;
  /** Modelo que respondió, o null en el agente propio. */
  model: string | null;
}

/** ¿Hay clave de Gemini configurada? Sin clave, ese motor no está disponible. */
export function isAIEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function buildPrompt(input: CheckInAnalysisInput): string {
  const alerts = input.alerts.length
    ? input.alerts.map((a) => `- ${a.type}: ${a.message}`).join("\n")
    : "- Sin alertas.";
  return [
    "Eres el asistente de RR.HH. de AsisBot, un sistema de control de asistencia laboral.",
    "Una marcación acaba de evaluarse con reglas deterministas. Explica el resultado en español claro y directo, como si hablaras con un supervisor que no es técnico.",
    "Reglas: no inventes datos que no están en la entrada. Si la similitud es simulada, dilo tal cual (no es una verificación biométrica real). La decisión final siempre la toma una persona; tú solo sugieres.",
    "",
    `Trabajador: ${input.workerName}`,
    `Tipo: ${input.type} · Estado: ${input.status}`,
    `Motivo del sistema: ${input.reason}`,
    `Alertas:\n${alerts}`,
    `Distancia a la zona: ${input.distanceM === null ? "sin ubicación" : `${input.distanceM} m`}`,
    `Similitud de selfie (SIMULADA): ${input.similarity === null ? "sin selfie" : `${input.similarity}%`}`,
    `Zona: ${input.zoneName ?? "sin zona asignada"} · Horario asignado: ${input.scheduleStart}`,
    "",
    "Responde SOLO con un JSON válido, sin markdown ni texto extra, con esta forma exacta:",
    '{"explanation": "2-3 frases", "suggestion": "una frase con la acción recomendada"}',
  ].join("\n");
}

async function callGemini(
  model: string,
  apiKey: string,
  prompt: string,
  timeoutMs: number,
): Promise<{ explanation: string; suggestion: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            // Gemini 3 Flash "piensa" antes de responder y esos tokens cuentan
            // dentro de maxOutputTokens: con 400 se quedaba sin espacio para
            // la respuesta (finishReason MAX_TOKENS). 2048 deja margen de sobra.
            maxOutputTokens: 2048,
            temperature: 0.3,
          },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as { explanation?: unknown; suggestion?: unknown };
    if (typeof parsed.explanation !== "string" || typeof parsed.suggestion !== "string") {
      return null;
    }
    return { explanation: parsed.explanation, suggestion: parsed.suggestion };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Intenta el análisis con Gemini. Devuelve null si no hay clave o si
 * Gemini no responde: el llamador cae al agente propio (ver agent.ts).
 * `budgetMs` limita el tiempo total (por defecto 30 s); cada intento de
 * modelo recibe como máximo lo que quede del presupuesto.
 */
export async function geminiAnalysis(
  input: CheckInAnalysisInput,
  budgetMs = 30000,
): Promise<CheckInAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = buildPrompt(input);
  const deadline = Date.now() + budgetMs;
  for (const model of MODEL_CANDIDATES) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const out = await callGemini(model, apiKey, prompt, Math.min(12000, remaining));
    if (out) {
      return { source: "gemini", explanation: out.explanation, suggestion: out.suggestion, model };
    }
  }
  return null;
}
