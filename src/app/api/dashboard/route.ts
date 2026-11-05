import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { chileInstant, chileToday } from "@/lib/tz";
import { chileDayKey } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export async function GET() {
  const t = chileToday();
  const start = chileInstant(t.year, t.month, t.day, 0, 0).toISOString();
  const end = chileInstant(t.year, t.month, t.day + 1, 0, 0).toISOString();

  const [
    { data: workers = [] },
    { data: todayCheckins = [] },
    { data: pendingAlerts = [] },
    { data: zones = [] },
  ] = await Promise.all([
    supabase.from("Worker").select("*, zone:Zone(*)").eq("active", true).order("name"),
    supabase.from("CheckIn").select("*, alerts:Alert(*)").gte("timestamp", start).lt("timestamp", end).order("timestamp"),
    supabase.from("Alert").select("*").eq("status", "PENDIENTE"),
    supabase.from("Zone").select("*"),
  ]);

  const byWorker = new Map<string, typeof todayCheckins>();
  for (const c of todayCheckins ?? []) {
    const list = byWorker.get(c.workerId) ?? [];
    list.push(c);
    byWorker.set(c.workerId, list);
  }

  const rows = (workers ?? []).map((w: Record<string, unknown>) => {
    const list = ((byWorker.get(w.id as string) ?? []) as Record<string, unknown>[])
      .filter((c) => !c.pendingSync)
      .sort((a, b) => new Date(a.timestamp as string).getTime() - new Date(b.timestamp as string).getTime());
    const pendientes = ((byWorker.get(w.id as string) ?? []) as Record<string, unknown>[]).filter((c) => c.pendingSync);
    const entrada = [...list].reverse().find((c) => c.type === "ENTRADA" && c.status !== "RECHAZADA") ?? null;
    const salida = [...list].reverse().find((c) => c.type === "SALIDA" && c.status !== "RECHAZADA") ?? null;
    const relevant = entrada ?? salida;
    const pendingOnLast = ((relevant?.alerts as Record<string, unknown>[] | null) ?? []).filter((a) => a.status === "PENDIENTE");
    const withPos = [...list].reverse().find((c) => c.lat !== null);

    let status = "AUSENTE";
    if (salida && salida.status !== "EN_REVISION") status = "JORNADA_TERMINADA";
    else if (relevant?.status === "EN_REVISION") {
      status = pendingOnLast.some((a) => a.type === "FUERA_ZONA") ? "FUERA_ZONA" : "EN_REVISION";
    } else if (entrada && entrada.status === "APROBADA") status = "PRESENTE";

    const zone = w.zone as Record<string, unknown> | null;
    return {
      id: w.id,
      name: w.name,
      position: w.position,
      avatarHue: w.avatarHue,
      phone: w.phone,
      zoneName: zone?.name ?? null,
      zoneId: w.zoneId,
      scheduleStart: w.scheduleStart,
      scheduleEnd: w.scheduleEnd,
      status,
      entrada: (entrada?.timestamp as string) ?? null,
      entradaStatus: (entrada?.status as string) ?? null,
      entradaSimilarity: (entrada?.similarity as number) ?? null,
      salida: (salida?.timestamp as string) ?? null,
      lastPoint: withPos ? { lat: withPos.lat, lng: withPos.lng } : null,
      checkinsToday: list.length,
      pendingAlertTypes: pendingOnLast.map((a) => a.type),
      pendingSyncTypes: pendientes.map((c) => c.type),
    };
  });

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const now = new Date();
  const syncedCount = (todayCheckins ?? []).filter((c: Record<string, unknown>) => !c.pendingSync).length;

  return NextResponse.json({
    generatedAt: now.toISOString(),
    chileDayKey: chileDayKey(now),
    kpis: {
      dotacion: rows.length,
      presentes: count("PRESENTE"),
      enRevision: count("EN_REVISION") + count("FUERA_ZONA"),
      jornadaTerminada: count("JORNADA_TERMINADA"),
      ausentes: count("AUSENTE"),
      alertasPendientes: (pendingAlerts ?? []).length,
      marcacionesHoy: syncedCount,
      pendientesSync: (todayCheckins ?? []).filter((c: Record<string, unknown>) => c.pendingSync).length,
    },
    workers: rows,
    zones: (zones ?? []).map((z: Record<string, unknown>) => ({
      id: z.id, name: z.name, lat: z.lat, lng: z.lng, radiusM: z.radiusM, address: z.address,
    })),
    todayCheckins: (todayCheckins ?? []).map((c: Record<string, unknown>) => ({
      id: c.id, workerId: c.workerId, type: c.type, timestamp: c.timestamp,
      lat: c.lat, lng: c.lng, status: c.status, similarity: c.similarity, pendingSync: c.pendingSync,
    })),
  });
}
