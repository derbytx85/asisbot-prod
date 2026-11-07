import { NextRequest, NextResponse } from "next/server";
import {
  analyzeCheckIn,
  isAIEnabled,
  type CheckInAnalysisInput,
} from "@/lib/agent";
import type { CheckStatus, CheckType } from "@/lib/attendance";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/analyze — explica una marcación ya evaluada con el agente
 * de AsisBot (motor propio de reglas por defecto; Gemini opcional con
 * AI_ENGINE=gemini). El agente sugiere; nunca decide. No guarda nada.
 *
 * Body: { workerName, type, status, reason, alerts, distanceM, similarity,
 *         zoneName, scheduleStart }
 * Respuesta: { source: "propio" | "gemini", explanation, suggestion, model }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const { workerName, type, status, reason, alerts } = body;
  if (
    typeof workerName !== "string" ||
    (type !== "ENTRADA" && type !== "SALIDA") ||
    !["APROBADA", "EN_REVISION", "RECHAZADA", "PENDIENTE_SYNC"].includes(status) ||
    typeof reason !== "string" ||
    !Array.isArray(alerts)
  ) {
    return NextResponse.json(
      { error: "workerName, type (ENTRADA|SALIDA), status, reason y alerts son obligatorios." },
      { status: 400 },
    );
  }

  const input: CheckInAnalysisInput = {
    workerName,
    type: type as CheckType,
    status: status as CheckStatus,
    reason,
    alerts: alerts
      .filter((a) => a && typeof a.type === "string" && typeof a.message === "string")
      .map((a) => ({ type: a.type, message: a.message })),
    distanceM: typeof body.distanceM === "number" ? body.distanceM : null,
    similarity: typeof body.similarity === "number" ? body.similarity : null,
    zoneName: typeof body.zoneName === "string" ? body.zoneName : null,
    scheduleStart: typeof body.scheduleStart === "string" ? body.scheduleStart : "",
  };

  const analysis = await analyzeCheckIn(input);
  return NextResponse.json({ ...analysis, aiEnabled: isAIEnabled() });
}
