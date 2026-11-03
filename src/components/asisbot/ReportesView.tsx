"use client";

// ─── Reportes ───────────────────────────────────────────────────────────────
// Reporte mensual para el contador (mejora §2) + reporte semanal por trabajador
// y día. Exportación a CSV compatible con Excel en es-CL (BOM UTF-8 + ';').

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink } from "lucide-react";
import { downloadMonthlyCsv, getMonthlyReport, getReports, getZones } from "./api";
import { fmtDayLabel, fmtMinutes } from "./format";
import type { ReportRow } from "./types";

/** Mes actual en hora de Chile (America/Santiago), "YYYY-MM" para input[type=month]. */
function currentChileMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

export function ReportesView() {
  const [days, setDays] = useState(7);
  const [month, setMonth] = useState<string>(currentChileMonth);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", days],
    queryFn: () => getReports(days),
  });

  const rows = data?.rows ?? [];

  const totalWorkedMin = useMemo(
    () => rows.reduce((acc, r) => acc + (r.workedMin ?? 0), 0),
    [rows],
  );

  // Reporte mensual para el contador (mejora §2)
  const monthlyQ = useQuery({
    queryKey: ["reports-monthly", month],
    queryFn: () => getMonthlyReport(month),
  });
  const zonesQ = useQuery({ queryKey: ["zones"], queryFn: getZones });
  const firstZoneId = zonesQ.data?.zones[0]?.id ?? null;

  async function copiarEnlaceMandante() {
    if (!firstZoneId) return;
    const url = `${window.location.origin}/#mandante?z=${firstZoneId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace de demo copiado", {
        description: "Abre esa URL para ver el portal del mandante (solo lectura).",
      });
    } catch {
      toast.error("No se pudo copiar el enlace.", { description: url });
    }
  }

  function exportCsv() {
    if (rows.length === 0) return;
    const header = [
      "Fecha",
      "Trabajador",
      "Cargo",
      "Entrada",
      "Salida",
      "Horas trabajadas",
      "Atraso (min)",
      "Alertas",
      "Alertas pendientes",
    ];
    const lines = rows.map((r) =>
      [
        r.date,
        r.workerName,
        r.position,
        r.entrada ?? "",
        r.salida ?? "",
        r.workedMin !== null ? fmtMinutes(r.workedMin) : "",
        r.lateMin > 0 ? String(r.lateMin) : "0",
        String(r.alertsCount),
        String(r.pendingAlerts),
      ]
        .map(csvCell)
        .join(";"),
    );
    const csv = "\uFEFF" + header.map(csvCell).join(";") + "\r\n" + lines.join("\r\n") + "\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asisbot-reporte-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const monthlyData = monthlyQ.data ?? null;
  const semanasExceden = monthlyData?.weeks.filter((w) => w.exceeds42).length ?? 0;

  return (
    <div className="space-y-4">
      {/* ── Reporte mensual para el contador (mejora §2) ── */}
      <section
        className="rounded-lg border border-border bg-card"
        aria-label="Reporte mensual para el contador"
      >
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3.5">
          <h2 className="text-[16px] font-semibold">Reporte mensual para el contador</h2>
          <button
            type="button"
            onClick={copiarEnlaceMandante}
            disabled={!firstZoneId}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-[13px] font-medium transition hover:bg-[#f4f6f4] disabled:opacity-40"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Vista mandante (demo)
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-1">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentChileMonth())}
            aria-label="Mes del reporte"
            className="h-8 rounded-md border border-input bg-white px-2.5 text-[13px]"
          />
          <button
            type="button"
            onClick={() => downloadMonthlyCsv(month)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Download className="size-3.5" aria-hidden />
            Exportar CSV
          </button>
          <p className="text-[12px] text-muted-foreground">
            BOM UTF-8 + &quot;;&quot; — listo para Excel es-CL
          </p>
        </div>

        <div className="px-4 pb-4">
          {monthlyQ.isLoading ? (
            <div className="space-y-2" aria-busy="true">
              <div className="h-4 w-72 rounded bg-[#f1f3f1]" aria-hidden />
              <div className="h-4 w-full max-w-md rounded bg-[#f1f3f1]" aria-hidden />
            </div>
          ) : monthlyQ.isError || !monthlyData ? (
            <p className="text-[13px] text-[var(--destructive)]">
              No se pudo cargar el reporte mensual para {month}.
            </p>
          ) : (
            <>
              <p className="num text-[13.5px]">
                {monthlyData.rows.length} jornadas · {monthlyData.correctionsCount} correcciones ·{" "}
                {semanasExceden} semanas &gt;42 h
              </p>
              <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                El reporte NO liquida sueldos: entrega la asistencia ordenada. Jornada de
                referencia: 42 h semanales (Chile, desde abril 2026; camino a 40 h).
              </p>
              <div className="scroll-fine mt-3 max-h-64 overflow-y-auto">
                <table className="w-full min-w-[560px] border-collapse text-[13px]">
                  <thead>
                    <tr className="sticky top-0 bg-card text-[12px] text-muted-foreground">
                      <th className="border-b border-[#eef0ee] py-1.5 pr-4 text-left font-normal">
                        Trabajador
                      </th>
                      <th className="border-b border-[#eef0ee] py-1.5 pr-4 text-left font-normal">
                        Semana del
                      </th>
                      <th className="num border-b border-[#eef0ee] py-1.5 pr-4 text-right font-normal">
                        Horas
                      </th>
                      <th className="border-b border-[#eef0ee] py-1.5 text-right font-normal">
                        Excede 42 h
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.weeks.map((w) => (
                      <tr
                        key={`${w.workerId}-${w.weekStart}`}
                        className="border-b border-[#eef0ee] last:border-b-0"
                      >
                        <td className="py-1.5 pr-4 font-medium">{w.workerName}</td>
                        <td className="py-1.5 pr-4 text-muted-foreground">
                          {fmtDayLabel(w.weekStart)}
                        </td>
                        <td className="num py-1.5 pr-4 text-right">{fmtMinutes(w.workedMin)}</td>
                        <td className="py-1.5 text-right">
                          {w.exceeds42 ? (
                            <span className="pill pill-warning">Excede 42 h</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {monthlyData.weeks.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-4 text-center text-[13px] text-muted-foreground"
                        >
                          Sin semanas registradas en este mes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {monthlyData.correctionsCount > 0 && (
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  Incluye {monthlyData.correctionsCount} corrección(es) auditada(s): el detalle va
                  por fila en el CSV.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Período del reporte"
          className="h-8 rounded-md border border-input bg-white px-2.5 text-[13px]"
        >
          <option value={7}>Últimos 7 días</option>
          <option value={14}>Últimos 14 días</option>
          <option value={30}>Últimos 30 días</option>
        </select>
        <p className="text-[12.5px] text-muted-foreground">
          {rows.length} jornadas registradas ·{" "}
          <span className="font-medium text-foreground">{fmtMinutes(totalWorkedMin)} trabajadas</span>
        </p>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Download className="size-3.5" aria-hidden />
          Exportar CSV
        </button>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Tabla de reporte">
        {isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded-md bg-[#f1f3f1]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="m-4 rounded-md border border-dashed border-border px-3 py-8 text-center">
            <p className="text-[14px] font-medium">Sin jornadas en este período.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Las marcaciones del simulador alimentan este reporte.
            </p>
          </div>
        ) : (
          <div className="scroll-fine overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-normal">Fecha</th>
                  <th className="px-4 py-2 text-left font-normal">Trabajador</th>
                  <th className="px-4 py-2 text-left font-normal">Cargo</th>
                  <th className="num px-4 py-2 text-right font-normal">Entrada</th>
                  <th className="num px-4 py-2 text-right font-normal">Salida</th>
                  <th className="num px-4 py-2 text-right font-normal">Horas trabajadas</th>
                  <th className="num px-4 py-2 text-right font-normal">Atraso</th>
                  <th className="num px-4 py-2 text-right font-normal">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <ReportLine key={`${r.date}-${r.workerId}-${r.entrada ?? "x"}`} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-[#eef0ee] px-4 py-2 text-[12px] text-muted-foreground">
          Horas calculadas entre la primera entrada aprobada y la última salida aprobada de
          cada jornada. Los indicadores de impacto de AsisBot son metas proyectadas, no
          resultados observados.
        </p>
      </section>
    </div>
  );
}

function ReportLine({ r }: { r: ReportRow }) {
  return (
    <tr className="border-t border-[#eef0ee] transition-colors hover:bg-[#f7f8f7]">
      <td className="num px-4 py-2 whitespace-nowrap text-muted-foreground">{fmtDayLabel(r.date)}</td>
      <td className="px-4 py-2 font-medium">{r.workerName}</td>
      <td className="px-4 py-2 text-muted-foreground">{r.position}</td>
      <td className="num px-4 py-2 text-right">{r.entrada ?? "—"}</td>
      <td className="num px-4 py-2 text-right">{r.salida ?? "—"}</td>
      <td className="num px-4 py-2 text-right">{fmtMinutes(r.workedMin)}</td>
      <td className="num px-4 py-2 text-right">
        {r.lateMin > 0 ? (
          <span className="pill pill-warning">{r.lateMin} min</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="num px-4 py-2 text-right">
        {r.alertsCount > 0 ? (
          <span className={r.pendingAlerts > 0 ? "pill pill-warning" : "pill pill-neutral"}>
            {r.alertsCount}
            {r.pendingAlerts > 0 ? ` (${r.pendingAlerts} pend.)` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
    </tr>
  );
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}
