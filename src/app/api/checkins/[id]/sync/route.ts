import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { evaluateCheckIn, evaluateSyncLate, type CheckType, type SelfieKind } from "@/lib/attendance";
import { chileInstant, chileToday } from "@/lib/tz";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: pendiente } = await supabase.from("CheckIn").select("*, worker:Worker(*, zone:Zone(*))").eq("id", id).single();
  if (!pendiente) return NextResponse.json({ error: "Marcación no encontrada." }, { status: 404 });
  if (!pendiente.pendingSync) return NextResponse.json({ error: "Esta marcación ya fue sincronizada." }, { status: 409 });

  const syncedAt = new Date();
  const originalAt = new Date(pendiente.timestamp);
  const t = chileToday();
  const start = chileInstant(t.year, t.month, t.day, 0, 0).toISOString();
  const end = chileInstant(t.year, t.month, t.day + 1, 0, 0).toISOString();

  const { data: todays } = await supabase.from("CheckIn").select("*").eq("workerId", pendiente.workerId).gte("timestamp", start).lt("timestamp", end).order("timestamp");
  const synced = (todays ?? []).filter((c) => !c.pendingSync);
  const lastSameTypeToday = [...synced].reverse().find((c) => c.type === pendiente.type && c.id !== id) ?? null;
  const firstEntradaToday = synced.find((c) => c.type === "ENTRADA" && c.status !== "RECHAZADA" && c.status !== "PENDIENTE_SYNC" && c.id !== id) ?? null;
  const prevMarkToday = [...synced].reverse().find((c) => c.id !== id && new Date(c.timestamp).getTime() < originalAt.getTime() && c.lat !== null && c.lng !== null) ?? null;

  const worker = pendiente.worker;
  const base = evaluateCheckIn({
    workerId: pendiente.workerId, type: pendiente.type as CheckType, now: originalAt,
    lat: pendiente.lat, lng: pendiente.lng, selfieKind: (pendiente.selfieKind ?? null) as SelfieKind | null,
    zone: worker.zone ? { name: worker.zone.name, lat: worker.zone.lat, lng: worker.zone.lng, radiusM: worker.zone.radiusM } : null,
    scheduleStart: worker.scheduleStart,
    lastSameTypeToday: lastSameTypeToday ? { timestamp: new Date(lastSameTypeToday.timestamp) } : null,
    firstEntradaToday, prevMarkToday: prevMarkToday ? { timestamp: new Date(prevMarkToday.timestamp), lat: prevMarkToday.lat, lng: prevMarkToday.lng } : null,
  });

  const result = evaluateSyncLate(base, originalAt, syncedAt);
  const { data: updated, error } = await supabase.from("CheckIn")
    .update({ status: result.status, distanceM: result.distanceM, similarity: result.similarity, reason: result.reason, pendingSync: false, syncAt: syncedAt.toISOString() })
    .eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const createdAlerts: Record<string, unknown>[] = [];
  for (const a of result.alerts) {
    const { data: alert } = await supabase.from("Alert").insert({ checkInId: id, type: a.type, message: a.message }).select().single();
    if (alert) createdAlerts.push(alert);
  }

  return NextResponse.json({ checkin: { ...updated, worker: { id: worker.id, name: worker.name, avatarHue: worker.avatarHue, position: worker.position } }, alerts: createdAlerts, result: { status: result.status, reason: result.reason, similarity: result.similarity, distanceM: result.distanceM, syncLateMin: result.syncLateMin ?? null } });
}
