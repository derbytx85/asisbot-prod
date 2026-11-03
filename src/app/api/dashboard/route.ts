import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chileInstant, chileToday, chileParts } from "@/lib/tz";
import { chileDayKey } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// GET /api/dashboard — vista en vivo: KPIs + estado por trabajador HOY
export async function GET() {
  const t = chileToday();
  const start = chileInstant(t.year, t.month, t.day, 0, 0);
  const end = chileInstant(t.year, t.month, t.day + 1, 0, 0);

  const [workers, todayCheckins, pendingAlerts, zones] = await Promise.all([
    db.worker.findMany({
      where: { active: true },
      include: { zone: true },
      orderBy: { name: "asc" },
    }),
    db.checkIn.findMany({
      where: { timestamp: { gte: start, lt: end } },
      include: { alerts: true },
      orderBy: { timestamp: "asc" },
    }),
    db.alert.findMany({ where: { status: "PENDIENTE" } }),
    db.zone.findMany(),
  ]);

  const byWorker = new Map<string, typeof todayCheckins>();
  for (const c of todayCheckins) {
    const list = byWorker.get(c.workerId) ?? [];
    list.push(c);
    byWorker.set(c.workerId, list);
  }

  const rows = workers.map((w) => {
    // Las marcas pendientes de sincronizar (sin señal) aún NO llegaron al
    // sistema: no cuentan como entrada/salida ni posición (mejora §4).
    const list = (byWorker.get(w.id) ?? [])
      .filter((c) => !c.pendingSync)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const pendientes = (byWorker.get(w.id) ?? []).filter((c) => c.pendingSync);
    // La entrada relevante es la ÚLTIMA no rechazada del día: una re-marcación
    // en revisión debe reflejar el estado actual, y una duplicada rechazada no
    // deshace la entrada aprobada anterior.
    const entrada =
      [...list].reverse().find((c) => c.type === "ENTRADA" && c.status !== "RECHAZADA") ?? null;
    const salida =
      [...list].reverse().find((c) => c.type === "SALIDA" && c.status !== "RECHAZADA") ?? null;
    const relevant = entrada ?? salida;
    const pendingOnLast = relevant?.alerts.filter((a) => a.status === "PENDIENTE") ?? [];
    const withPos = [...list].reverse().find((c) => c.lat !== null);

    let status: string = "AUSENTE";
    if (salida && salida.status !== "EN_REVISION") status = "JORNADA_TERMINADA";
    else if (relevant?.status === "EN_REVISION") {
      status = pendingOnLast.some((a) => a.type === "FUERA_ZONA")
        ? "FUERA_ZONA"
        : "EN_REVISION";
    } else if (entrada && entrada.status === "APROBADA") status = "PRESENTE";

    return {
      id: w.id,
      name: w.name,
      position: w.position,
      avatarHue: w.avatarHue,
      phone: w.phone,
      zoneName: w.zone?.name ?? null,
      zoneId: w.zoneId,
      scheduleStart: w.scheduleStart,
      scheduleEnd: w.scheduleEnd,
      status,
      entrada: entrada?.timestamp ?? null,
      entradaStatus: entrada?.status ?? null,
      entradaSimilarity: entrada?.similarity ?? null,
      salida: salida?.timestamp ?? null,
      lastPoint: withPos ? { lat: withPos.lat!, lng: withPos.lng! } : null,
      checkinsToday: list.length,
      pendingAlertTypes: pendingOnLast.map((a) => a.type),
      /** Tipos de marcas guardadas en el teléfono esperando señal (mejora §4). */
      pendingSyncTypes: pendientes.map((c) => c.type),
    };
  });

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const now = new Date();
  const syncedCount = todayCheckins.filter((c) => !c.pendingSync).length;

  return NextResponse.json({
    generatedAt: now.toISOString(),
    chileDayKey: chileDayKey(now),
    kpis: {
      dotacion: rows.length,
      presentes: count("PRESENTE"),
      enRevision: count("EN_REVISION") + count("FUERA_ZONA"),
      jornadaTerminada: count("JORNADA_TERMINADA"),
      ausentes: count("AUSENTE"),
      alertasPendientes: pendingAlerts.length,
      marcacionesHoy: syncedCount,
      pendientesSync: todayCheckins.filter((c) => c.pendingSync).length,
    },
    workers: rows,
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      lat: z.lat,
      lng: z.lng,
      radiusM: z.radiusM,
      address: z.address,
    })),
    todayCheckins: todayCheckins.map((c) => ({
      id: c.id,
      workerId: c.workerId,
      type: c.type,
      timestamp: c.timestamp,
      lat: c.lat,
      lng: c.lng,
      status: c.status,
      similarity: c.similarity,
      pendingSync: c.pendingSync,
    })),
  });
}
