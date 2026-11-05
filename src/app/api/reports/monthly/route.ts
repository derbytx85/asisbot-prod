import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { chileInstant, chileParts } from "@/lib/tz";
import { chileDayKey, hhmmToMinutes, formatHHMM, LATE_TOLERANCE_MIN } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// GET /api/reports/monthly?month=YYYY-MM&format=json|csv
// Reporte mensual para el contador (mejora §2): por trabajador y día →
// horas trabajadas, atrasos y marcas corregidas (con motivo). Distinción de
// jornada semanal con la referencia 42 h vigente en Chile desde abril 2026.
// NO liquida sueldos: solo entrega la asistencia ordenada.

/** Fila de CheckIn tal como la devuelve Supabase (fechas como strings ISO). */
type MonthlyCheckIn = {
  id: string;
  workerId: string;
  type: string;
  timestamp: string;
  status: string;
  pendingSync: boolean | null;
  worker: {
    id: string;
    name: string;
    position: string;
    scheduleStart: string;
    zone: { name: string } | null;
  } | null;
  alerts: Array<{ type: string; status: string }>;
  corrections: Array<{
    field: string;
    oldValue: string;
    newValue: string;
    reason: string;
  }>;
};

function monthRange(month: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  const start = chileInstant(year, mon, 1, 0, 0);
  const end = mon === 12 ? chileInstant(year + 1, 1, 1, 0, 0) : chileInstant(year, mon + 1, 1, 0, 0);
  return { start, end, year, mon };
}

/** Lunes de la semana (clave ISO) para el resumen 42 h. */
function mondayKey(d: Date): string {
  const p = chileParts(d);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day);
  const dow = new Date(asUTC).getUTCDay(); // 0 dom … 6 sáb
  const back = (dow + 6) % 7;
  const mon = new Date(asUTC - back * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month") ?? "";
  const format = sp.get("format") ?? "json";
  const range = monthRange(month);
  if (!range) {
    return NextResponse.json({ error: "month debe tener formato YYYY-MM." }, { status: 400 });
  }
  const { start, end } = range;

  const { data, error } = await supabase
    .from("CheckIn")
    .select(
      "*, worker:Worker(id, name, position, scheduleStart, zone:Zone(name)), alerts:Alert(*), corrections:Correction(*)",
    )
    .gte("timestamp", start.toISOString())
    .lt("timestamp", end.toISOString())
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "No se pudo generar el reporte mensual." },
      { status: 500 },
    );
  }
  const checkins = (data ?? []) as MonthlyCheckIn[];

  const groups = new Map<string, MonthlyCheckIn[]>();
  for (const c of checkins) {
    const key = `${c.workerId}|${chileDayKey(new Date(c.timestamp))}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const rows: Array<{
    date: string;
    workerId: string;
    workerName: string;
    position: string;
    zoneName: string | null;
    entrada: string | null;
    salida: string | null;
    workedMin: number | null;
    lateMin: number;
    correctionsCount: number;
    correctionsDetail: string;
  }> = [];

  const weekMap = new Map<string, number>(); // workerId|weekStart → workedMin

  for (const [, list] of groups) {
    const first = list[0];
    const worker = first.worker;
    if (!worker) continue; // sin trabajador asociado no hay fila posible
    const dayKey = chileDayKey(new Date(first.timestamp));
    const synced = list.filter((c) => !c.pendingSync);
    const entrada =
      synced.find((c) => c.type === "ENTRADA" && c.status !== "RECHAZADA") ?? null;
    const salida =
      [...synced].reverse().find((c) => c.type === "SALIDA" && c.status === "APROBADA") ?? null;
    let workedMin: number | null = null;
    if (entrada && salida) {
      workedMin = Math.max(
        0,
        Math.round(
          (new Date(salida.timestamp).getTime() - new Date(entrada.timestamp).getTime()) /
            60000,
        ),
      );
      const wk = `${first.workerId}|${mondayKey(new Date(first.timestamp))}`;
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + workedMin);
    }
    let lateMin = 0;
    if (entrada) {
      const hasAtraso = list.flatMap((c) => c.alerts).some((a) => a.type === "ATRASO");
      if (hasAtraso && worker.scheduleStart) {
        const p = chileParts(new Date(entrada.timestamp));
        const wallMin = p.hour * 60 + p.minute;
        lateMin = Math.max(0, wallMin - hhmmToMinutes(worker.scheduleStart));
        if (lateMin <= LATE_TOLERANCE_MIN) lateMin = 0;
      }
    }
    const corrections = list.flatMap((c) => c.corrections ?? []);
    rows.push({
      date: dayKey,
      workerId: first.workerId,
      workerName: worker.name,
      position: worker.position,
      zoneName: worker.zone?.name ?? null,
      entrada: entrada ? formatHHMM(new Date(entrada.timestamp)) : null,
      salida: salida ? formatHHMM(new Date(salida.timestamp)) : null,
      workedMin,
      lateMin,
      correctionsCount: corrections.length,
      correctionsDetail: corrections
        .map((c) => `${c.field === "timestamp" ? "hora" : "estado"} ${c.oldValue}→${c.newValue} (${c.reason})`)
        .join(" | "),
    });
  }

  rows.sort((a, b) => (a.date === b.date ? a.workerName.localeCompare(b.workerName) : a.date.localeCompare(b.date)));

  const workerNames = new Map(rows.map((r) => [r.workerId, r.workerName]));
  const weeks = [...weekMap.entries()].map(([k, workedMin]) => {
    const [workerId, weekStart] = k.split("|");
    return {
      workerId,
      workerName: workerNames.get(workerId) ?? workerId,
      weekStart,
      workedMin,
      exceeds42: workedMin > 42 * 60,
    };
  });
  weeks.sort((a, b) => (a.weekStart === b.weekStart ? a.workerName.localeCompare(b.workerName) : a.weekStart.localeCompare(b.weekStart)));

  const correctionsCount = checkins.reduce((n, c) => n + (c.corrections ?? []).length, 0);
  const generatedAt = new Date().toISOString();

  // ── CSV listo para el contador (Excel es-CL: BOM + ';' + CRLF) ──
  if (format === "csv") {
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines: string[] = [];
    lines.push(
      ["Fecha", "Trabajador", "Cargo", "Zona", "Entrada", "Salida", "Horas trabajadas (min)", "Atraso (min)", "Correcciones", "Detalle de correcciones"]
        .map(cell)
        .join(";"),
    );
    for (const r of rows) {
      lines.push(
        [r.date, r.workerName, r.position, r.zoneName ?? "", r.entrada ?? "", r.salida ?? "", r.workedMin ?? "", r.lateMin, r.correctionsCount, r.correctionsDetail]
          .map(cell)
          .join(";"),
      );
    }
    lines.push("");
    lines.push(["Resumen semanal (jornada de referencia 42 h, Chile 2026)"].map(cell).join(";"));
    lines.push(["Trabajador", "Semana del", "Horas trabajadas (min)", "Excede 42 h"].map(cell).join(";"));
    for (const w of weeks) {
      lines.push(
        [w.workerName, w.weekStart, w.workedMin, w.exceeds42 ? "Sí" : "No"].map(cell).join(";"),
      );
    }
    lines.push("");
    lines.push(
      cell(`Generado por AsisBot (demo, datos ficticios) el ${generatedAt}. No liquida sueldos: solo asistencia ordenada.`),
    );
    const csv = "\uFEFF" + lines.join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="asisbot-asistencia-${month}.csv"`,
      },
    });
  }

  return NextResponse.json({
    month,
    generatedAt,
    rows,
    weeks,
    correctionsCount,
  });
}
