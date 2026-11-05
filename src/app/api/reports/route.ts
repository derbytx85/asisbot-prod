import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { chileInstant, chileToday, chileParts } from "@/lib/tz";
import { chileDayKey, hhmmToMinutes, formatHHMM, LATE_TOLERANCE_MIN } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// GET /api/reports?days=7
// Tabla por trabajador y por día: primera entrada, última salida (aprobadas),
// horas trabajadas, atraso (min) y alertas del día.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 7), 1), 31);

  const t = chileToday();
  const start = chileInstant(t.year, t.month, t.day - (days - 1), 0, 0);
  const end = chileInstant(t.year, t.month, t.day + 1, 0, 0);

  const checkins = await db.checkIn.findMany({
    where: { timestamp: { gte: start, lt: end } },
    include: {
      worker: {
        select: {
          id: true,
          name: true,
          position: true,
          avatarHue: true,
          scheduleStart: true,
        },
      },
      alerts: true,
    },
    orderBy: { timestamp: "asc" },
  });

  // Agrupar por trabajador y día chileno
  const groups = new Map<string, typeof checkins>();
  for (const c of checkins) {
    const key = `${c.workerId}|${chileDayKey(c.timestamp)}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const rows: Array<{
    date: string;
    workerId: string;
    workerName: string;
    position: string;
    entrada: string | null;
    salida: string | null;
    workedMin: number | null;
    lateMin: number;
    alertsCount: number;
    pendingAlerts: number;
  }> = [];

  for (const [, list] of groups) {
    const first = list[0];
    const dayKey = chileDayKey(first.timestamp);
    const entrada =
      list.find((c) => c.type === "ENTRADA" && c.status !== "RECHAZADA") ?? null;
    const salida =
      [...list].reverse().find((c) => c.type === "SALIDA" && c.status === "APROBADA") ??
      null;
    let workedMin: number | null = null;
    if (entrada && salida) {
      workedMin = Math.max(
        0,
        Math.round((salida.timestamp.getTime() - entrada.timestamp.getTime()) / 60000),
      );
    }
    let lateMin = 0;
    if (entrada) {
      const hasAtraso = list.flatMap((c) => c.alerts).some((a) => a.type === "ATRASO");
      if (hasAtraso && first.worker.scheduleStart) {
        const p = chileParts(entrada.timestamp);
        const wallMin = p.hour * 60 + p.minute;
        lateMin = Math.max(0, wallMin - hhmmToMinutes(first.worker.scheduleStart));
        if (lateMin <= LATE_TOLERANCE_MIN) lateMin = 0;
      }
    }
    const alertsAll = list.flatMap((c) => c.alerts);
    rows.push({
      date: dayKey,
      workerId: first.workerId,
      workerName: first.worker.name,
      position: first.worker.position,
      entrada: entrada ? formatHHMM(entrada.timestamp) : null,
      salida: salida ? formatHHMM(salida.timestamp) : null,
      workedMin,
      lateMin,
      alertsCount: alertsAll.length,
      pendingAlerts: alertsAll.filter((a) => a.status === "PENDIENTE").length,
    });
  }

  rows.sort((a, b) => (a.date === b.date ? a.workerName.localeCompare(b.workerName) : b.date.localeCompare(a.date)));

  const now = new Date();

  return NextResponse.json({
    days,
    generatedAt: now.toISOString(),
    rows,
  });
}
