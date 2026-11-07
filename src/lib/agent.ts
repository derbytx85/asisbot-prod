// ─── AsisBot · Agente propio ────────────────────────────────────────────────
// El agente de AsisBot vive DENTRO del proyecto: no necesita clave, no hace
// llamadas externas, no cuesta nada y siempre responde igual con la misma
// entrada (determinista). Explica en lenguaje claro por qué una marcación
// quedó en revisión y sugiere la acción para RR.HH.
//
// Qué hace el agente (por orden):
//   1. Lee el resultado ya evaluado por el motor (`evaluateCheckIn`).
//   2. Clasifica el riesgo de la marcación según sus alertas.
//   3. Detecta combinaciones que agravan el caso (p. ej. suplantación +
//      fuera de zona) y lo dice explícitamente.
//   4. Elige la acción recomendada según la alerta de mayor prioridad.
//
// La verificación facial sigue siendo SIMULADA (ver attendance.ts): las
// selfies de la demo son ilustraciones. El agente no compara rostros ni
// decide nada: solo explica y sugiere. La decisión final siempre es humana.
//
// Motores (configuración en .env):
//   AI_ENGINE=propio   agente de reglas (por defecto; sin costo ni red)
//   AI_ENGINE=gemini   motor Gemini opcional (ver src/lib/ai.ts); si no hay
//                      clave o Gemini no responde, cae al agente propio.

import type { AlertDraft, AlertType, CheckStatus, CheckType } from "./attendance";
import {
  geminiAnalysis,
  isAIEnabled,
  type CheckInAnalysis,
  type CheckInAnalysisInput,
} from "./ai";

export { isAIEnabled };
export type { CheckInAnalysis, CheckInAnalysisInput };

// ─── Riesgo y prioridad ─────────────────────────────────────────────────────

type Risk = "alto" | "medio" | "bajo";

const RISK: Record<AlertType, Risk> = {
  SUPLANTACION: "alto",
  INCOHERENTE: "alto",
  FUERA_ZONA: "medio",
  FOTO_GALERIA: "medio",
  SIN_SELFIE: "medio",
  SIN_UBICACION: "medio",
  SYNC_TARDE: "medio",
  SIN_ENTRADA: "medio",
  DUPLICADA: "bajo",
  ATRASO: "bajo",
};

/** Orden de prioridad para elegir la acción recomendada. */
const PRIORITY: AlertType[] = [
  "SUPLANTACION",
  "FUERA_ZONA",
  "INCOHERENTE",
  "FOTO_GALERIA",
  "SIN_SELFIE",
  "SIN_UBICACION",
  "SYNC_TARDE",
  "SIN_ENTRADA",
  "DUPLICADA",
  "ATRASO",
];

// ─── Qué significa cada alerta (para el supervisor) ─────────────────────────

const WHAT_IT_MEANS: Record<AlertType, string> = {
  SUPLANTACION:
    "La selfie no coincide con la foto de referencia del trabajador: hay riesgo de suplantación.",
  FUERA_ZONA:
    "La marca se hizo fuera del radio autorizado de la zona asignada.",
  FOTO_GALERIA:
    "La foto no fue tomada en el momento, sino elegida de la galería: podría ser una foto vieja.",
  SIN_SELFIE:
    "La marcación llegó sin selfie, así que no se pudo verificar la identidad.",
  SIN_UBICACION:
    "La marcación llegó sin ubicación compartida, así que no se pudo verificar la zona.",
  SIN_ENTRADA:
    "Se registró una salida sin una entrada previa hoy.",
  DUPLICADA:
    "Ya existía una marcación igual hace pocos minutos.",
  ATRASO:
    "La entrada fue después del horario asignado.",
  INCOHERENTE:
    "La ubicación no es coherente con la marca anterior del día: el desplazamiento no es posible en ese tiempo.",
  SYNC_TARDE:
    "La marca se hizo sin señal y llegó tarde al sistema.",
};

// ─── Acción recomendada por alerta ───────────────────────────────────────────

const SUGGESTION: Record<AlertType, string> = {
  SUPLANTACION:
    "Que un supervisor compare la selfie con la foto de referencia y valide la identidad antes de aprobar o rechazar.",
  FUERA_ZONA:
    "Confirmar con el trabajador el motivo de la ubicación y, si corresponde, revisar la zona asignada.",
  INCOHERENTE:
    "Revisar la marca anterior del día y confirmar con el trabajador cómo se desplazó.",
  FOTO_GALERIA:
    "Pedir al trabajador que repita la marca con una foto tomada en el momento.",
  SIN_SELFIE:
    "Pedir al trabajador que repita la marca con selfie de verificación.",
  SIN_UBICACION:
    "Pedir al trabajador que repita la marca compartiendo su ubicación.",
  SYNC_TARDE:
    "Confirmar que la marca se hizo a la hora original y que no se perdió información.",
  SIN_ENTRADA:
    "Revisar si la entrada no se registró o se hizo por otro canal.",
  DUPLICADA:
    "No requiere acción: la marcación duplicada ya fue rechazada por el sistema.",
  ATRASO:
    "Registrar el atraso; no requiere revisión.",
};

// ─── Combinaciones que agravan el caso ──────────────────────────────────────

function combinationNote(types: Set<AlertType>): string | null {
  if (types.has("SUPLANTACION") && types.has("FUERA_ZONA")) {
    return "La combinación de posible suplantación y ubicación fuera de zona es la señal de mayor riesgo de esta marcación.";
  }
  if (types.has("FOTO_GALERIA") && types.has("FUERA_ZONA")) {
    return "Que la foto sea de galería y la ubicación esté fuera de zona a la vez refuerza la sospecha: validar identidad y ubicación.";
  }
  if (types.has("SIN_SELFIE") && types.has("SIN_UBICACION")) {
    return "Sin selfie y sin ubicación no hay forma de verificar esta marca: debe repetirse.";
  }
  if (types.has("SUPLANTACION") && types.has("FOTO_GALERIA")) {
    return "La baja similitud y la foto de galería apuntan en la misma dirección: validar la identidad antes de aprobar.";
  }
  return null;
}

function riskOf(types: AlertType[]): Risk {
  if (types.some((t) => RISK[t] === "alto")) return "alto";
  if (types.some((t) => RISK[t] === "medio")) return "medio";
  return "bajo";
}

function pickSuggestion(types: AlertType[], status: CheckStatus): string {
  for (const t of PRIORITY) {
    if (types.includes(t)) return SUGGESTION[t];
  }
  return status === "APROBADA"
    ? "No requiere acción."
    : "Un supervisor debe revisar esta marcación y aprobarla o rechazarla con motivo.";
}

// ─── Agente propio (reglas) ─────────────────────────────────────────────────

/**
 * Analiza una marcación ya evaluada con el agente propio de reglas.
 * Determinista: la misma entrada produce siempre la misma salida.
 */
export function analyzeWithRules(input: CheckInAnalysisInput): CheckInAnalysis {
  const { workerName, type, status, alerts } = input;
  const types = alerts.map((a) => a.type);
  const typeSet = new Set(types);

  // Sin señal: todavía no hay nada que evaluar.
  if (status === "PENDIENTE_SYNC") {
    return {
      source: "propio",
      explanation: `La marcación de ${workerName} se guardó en el teléfono sin señal y aún no se sincroniza; conserva su hora original.`,
      suggestion: "Esperar a que el teléfono recupere señal; si no sincroniza, pedir al trabajador que la reenvíe.",
      model: null,
    };
  }

  // Marcación correcta: el motivo del motor ya es la explicación completa.
  if (status === "APROBADA" && alerts.length === 0) {
    return {
      source: "propio",
      explanation: input.reason,
      suggestion: "No requiere acción.",
      model: null,
    };
  }

  // Veredicto con nivel de riesgo.
  const risk = riskOf(types);
  const verdict =
    status === "APROBADA"
      ? `La marcación de ${workerName} quedó aprobada, con una observación (riesgo ${risk}).`
      : status === "RECHAZADA"
        ? `La marcación de ${workerName} fue rechazada por el sistema.`
        : `La marcación de ${workerName} quedó en revisión (riesgo ${risk}).`;

  // Detalle: qué significa cada alerta + el dato concreto del motor.
  const details = alerts
    .map((a: AlertDraft) => `${WHAT_IT_MEANS[a.type]} ${a.message}`)
    .join(" ");

  const combo = combinationNote(typeSet);
  const explanation = combo ? `${verdict} ${details} ${combo}` : `${verdict} ${details}`;

  return {
    source: "propio",
    explanation,
    suggestion: pickSuggestion(types, status),
    model: null,
  };
}

// ─── Despachador: elige el motor ────────────────────────────────────────────

/**
 * Analiza una marcación con el motor configurado en AI_ENGINE.
 * Por defecto usa el agente propio (sin costo ni red). Con
 * AI_ENGINE=gemini usa Gemini si hay clave y responde; si no, cae al
 * agente propio. Nunca lanza errores.
 */
export async function analyzeCheckIn(
  input: CheckInAnalysisInput,
  budgetMs = 30000,
): Promise<CheckInAnalysis> {
  const engine = (process.env.AI_ENGINE ?? "propio").trim().toLowerCase();
  if (engine === "gemini") {
    const out = await geminiAnalysis(input, budgetMs);
    if (out) return out;
  }
  return analyzeWithRules(input);
}
