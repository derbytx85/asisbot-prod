import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chileInstant, chileToday, chileParts } from "@/lib/tz";
import { LATE_TOLERANCE_MIN, formatHHMM, hhmmToMinutes } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// GET /api/mandante?zoneId=&day=YYYY-MM-DD
// Reporte para el cliente mandante (mejora §3): dotación esperada, presentes,
// ausentes, atrasos y evidencia de presencia por instalación y día.
// SOLO LECTURA y sin datos sensibles: no expone RUT, teléfono ni historial
// completo del trabajador; solo la asistencia del día en esa instalación.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const zoneId = sp.get("zoneId");
  if (!zoneId) {
    return NextResponse.json({ error: "zoneId es obligatorio." }, { status: 400 });
  }
  const dayParam = sp.get("day");
  let day: { year: number; month: number; day: number };
  if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
    const [y, m, d] = dayParam.split("-").map(Number);
    day = { year: y, month: m, day: d };
  } else {
    day = chileToday();
  }

  const zone = await db.zone.findUnique({ where: { id: zoneId } });
  if (!zone) {
    return NextResponse.json({ error: "Instalación no encontrada." }, { status: 404 });
  }

  const start = chileInstant(day.year, day.month, day.day, 0, 0);
  const end = chileInstant(day.year, day.month, day.day + 1, 0, 0);

  const workers = await db.worker.findMany({
    where: { zoneId, active: true },
    orderBy: { name: "asc" },
  });

  const checkins = await db.checkIn.findMany({
    where: {
      timestamp: { gte: start, lt: end },
      worker: { zoneId, active: true },
    },
    include: { alerts: true },
    orderBy: { timestamp: "asc" },
  });

  const byWorker = new Map<string, typeof checkins>();
  for (const c of checkins) {
    const list = byWorker.get(c.workerId) ?? [];
    list.push(c);
    byWorker.set(c.workerId, list);
  }

  const rows = workers.map((w) => {
    const list = byWorker.get(w.id) ?? [];
    const synced = list.filter((c) => !c.pendingSync);
    const pendientes = list.filter((c) => c.pendingSync);
    const entrada =
      [...synced].reverse().find((c) => c.type === "ENTRADA" && c.status !== "RECHAZADA") ?? null;
    const salida =
      [...synced].reverse().find((c) => c.type === "SALIDA" && c.status !== "RECHAZADA") ?? null;
    const relevant = entrada ?? salida;

    let estado: string = "AUSENTE";
    if (pendientes.length > 0 && !entrada) estado = "PENDIENTE_SYNC";
    if (salida && salida.status !== "EN_REVISION") estado = "JORNADA_TERMINADA";
    else if (relevant?.status === "EN_REVISION") estado = "EN_REVISION";
    else if (entrada && entrada.status === "APROBADA") estado = "PRESENTE";

    let lateMin = 0;
    if (entrada) {
      const hasAtraso = list.flatMap((c) => c.alerts).some((a) => a.type === "ATRASO");
      if (hasAtraso) {
        const p = chileParts(entrada.timestamp);
        lateMin = Math.max(0, p.hour * 60 + p.minute - hhmmToMinutes(w.scheduleStart));
        if (lateMin <= LATE_TOLERANCE_MIN) lateMin = 0;
      }
    }

    return {
      id: w.id,
      name: w.name,
      position: w.position,
      scheduleStart: w.scheduleStart,
      scheduleEnd: w.scheduleEnd,
      estado,
      entrada: entrada ? formatHHMM(entrada.timestamp) : null,
      salida: salida ? formatHHMM(salida.timestamp) : null,
      lateMin,
      evidencia: list
        .filter((c) => c.status !== "RECHAZADA")
        .map((c) => ({
          type: c.type as "ENTRADA" | "SALIDA",
          timestamp: c.timestamp.toISOString(),
          status: c.status,
          distanceM: c.distanceM,
          similarity: c.similarity,
          // ubicación aproximada (~110 m) para no exponer la posición exacta
          latApprox: c.lat !== null ? Math.round(c.lat * 1000) / 1000 : null,
          lngApprox: c.lng !== null ? Math.round(c.lng * 1000) / 1000 : null,
          syncAt: c.syncAt ? c.syncAt.toISOString() : null,
        })),
    };
  });

  const presentes = rows.filter((r) => r.estado === "PRESENTE" || r.estado === "JORNADA_TERMINADA").length;
  const ausentes = rows.filter((r) => r.estado === "AUSENTE").length;
  const atrasos = rows.filter((r) => r.lateMin > 0).length;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    day: `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`,
    zone: { id: zone.id, name: zone.name, address: zone.address },
    summary: {
      esperados: rows.length,
      presentes,
      ausentes,
      atrasos,
    },
    workers: rows,
  });
}
