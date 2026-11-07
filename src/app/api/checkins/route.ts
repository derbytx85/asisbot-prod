import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { evaluateCheckIn, type CheckType, type SelfieKind } from "@/lib/attendance";
import { analyzeCheckIn } from "@/lib/agent";
import { chileInstant, chileToday } from "@/lib/tz";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "today";
  const workerId = sp.get("workerId");
  const status = sp.get("status");
  const reviewed = sp.get("reviewed");

  let query = supabase
    .from("CheckIn")
    .select("*, worker:Worker(id,name,avatarHue,position), alerts:Alert(*), corrections:Correction(*)")
    .order(reviewed === "1" ? "reviewedAt" : "timestamp", { ascending: false })
    .limit(200);

  if (reviewed === "1") {
    query = query.not("reviewedAt", "is", null);
  } else if (scope === "today") {
    const t = chileToday();
    query = query
      .gte("timestamp", chileInstant(t.year, t.month, t.day, 0, 0).toISOString())
      .lt("timestamp", chileInstant(t.year, t.month, t.day + 1, 0, 0).toISOString());
  }
  if (workerId) query = query.eq("workerId", workerId);
  if (status) query = query.eq("status", status);

  const { data: checkins, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checkins });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const { workerId, type, lat, lng, selfieKind, offline } = body;
  if (!workerId || (type !== "ENTRADA" && type !== "SALIDA"))
    return NextResponse.json({ error: "workerId y type (ENTRADA|SALIDA) son obligatorios." }, { status: 400 });
  if (selfieKind !== undefined && selfieKind !== null && !["referencia","otra","galeria"].includes(selfieKind))
    return NextResponse.json({ error: "selfieKind inválido." }, { status: 400 });

  const { data: worker } = await supabase
    .from("Worker").select("*, zone:Zone(*), consents:Consent(*)").eq("id", workerId).single();
  if (!worker) return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
  if (!worker.active) return NextResponse.json({ error: "El trabajador está desactivado." }, { status: 409 });
  if (!worker.consents?.length)
    return NextResponse.json({ error: "Este trabajador aún no ha aceptado el consentimiento de privacidad.", code: "CONSENT_REQUIRED" }, { status: 403 });

  const now = body.demoAt ? new Date(String(body.demoAt)) : new Date();
  if (Number.isNaN(now.getTime())) return NextResponse.json({ error: "demoAt inválido." }, { status: 400 });

  const t = chileToday();
  const start = chileInstant(t.year, t.month, t.day, 0, 0).toISOString();
  const end = chileInstant(t.year, t.month, t.day + 1, 0, 0).toISOString();
  const { data: todays } = await supabase.from("CheckIn").select("*").eq("workerId", workerId).gte("timestamp", start).lt("timestamp", end).order("timestamp");

  const latN = lat === undefined || lat === null ? null : Number(lat);
  const lngN = lng === undefined || lng === null ? null : Number(lng);
  const hasPos = latN !== null && lngN !== null && Number.isFinite(latN) && Number.isFinite(lngN);

  if (offline === true) {
    const { data: pendiente, error } = await supabase.from("CheckIn").insert({
      workerId, type, timestamp: now.toISOString(),
      lat: hasPos ? latN : null, lng: hasPos ? lngN : null,
      status: "PENDIENTE_SYNC", selfieKind: selfieKind ?? null, pendingSync: true,
      reason: `Guardada en el teléfono sin señal a las ${now.toISOString()}. Se enviará cuando vuelva la cobertura; conserva su hora original.`,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ checkin: { ...pendiente, worker: { id: worker.id, name: worker.name, avatarHue: worker.avatarHue, position: worker.position } }, alerts: [], result: { status: "PENDIENTE_SYNC", reason: pendiente.reason, similarity: null, distanceM: null } }, { status: 201 });
  }

  const synced = (todays ?? []).filter((c) => !c.pendingSync);
  const lastSameTypeToday = [...synced].reverse().find((c) => c.type === type) ?? null;
  const firstEntradaToday = synced.find((c) => c.type === "ENTRADA" && c.status !== "RECHAZADA" && c.status !== "PENDIENTE_SYNC") ?? null;
  const prevMarkToday = [...synced].reverse().find((c) => new Date(c.timestamp).getTime() < now.getTime() && c.lat !== null && c.lng !== null) ?? null;

  const result = evaluateCheckIn({
    workerId, type: type as CheckType, now,
    lat: hasPos ? latN : null, lng: hasPos ? lngN : null,
    selfieKind: (selfieKind ?? null) as SelfieKind | null,
    zone: worker.zone ? { name: worker.zone.name, lat: worker.zone.lat, lng: worker.zone.lng, radiusM: worker.zone.radiusM } : null,
    scheduleStart: worker.scheduleStart,
    lastSameTypeToday: lastSameTypeToday ? { timestamp: new Date(lastSameTypeToday.timestamp) } : null,
    firstEntradaToday, prevMarkToday: prevMarkToday ? { timestamp: new Date(prevMarkToday.timestamp), lat: prevMarkToday.lat, lng: prevMarkToday.lng } : null,
  });

  const { data: checkin, error: ciError } = await supabase.from("CheckIn").insert({
    workerId, type, timestamp: now.toISOString(),
    lat: hasPos ? latN : null, lng: hasPos ? lngN : null,
    distanceM: result.distanceM, status: result.status,
    similarity: result.similarity, selfieKind: selfieKind ?? null, reason: result.reason,
  }).select().single();
  if (ciError) return NextResponse.json({ error: ciError.message }, { status: 500 });

  const createdAlerts: Record<string, unknown>[] = [];
  for (const a of result.alerts) {
    const { data: alert } = await supabase.from("Alert").insert({ checkInId: checkin.id, type: a.type, message: a.message }).select().single();
    if (alert) createdAlerts.push(alert);
  }

  // Análisis con el agente de AsisBot (motor propio por defecto; Gemini
  // opcional con AI_ENGINE=gemini). Nunca bloquea la marcación: como
  // máximo 15 s y con respaldo del agente propio.
  const ai = await analyzeCheckIn({
    workerName: worker.name,
    type: type as CheckType,
    status: result.status,
    reason: result.reason,
    alerts: result.alerts,
    distanceM: result.distanceM,
    similarity: result.similarity,
    zoneName: worker.zone ? worker.zone.name : null,
    scheduleStart: worker.scheduleStart,
  }, 15000);

  return NextResponse.json({ checkin: { ...checkin, worker: { id: worker.id, name: worker.name, avatarHue: worker.avatarHue, position: worker.position } }, alerts: createdAlerts, result: { status: result.status, reason: result.reason, similarity: result.similarity, distanceM: result.distanceM }, ai }, { status: 201 });
}
