"use client";

// ─── Portal del mandante (mejora §3, vista pública de demo) ─────────────────
// Página completa, SOLO LECTURA: simula lo que vería el cliente mandante de
// una instalación. Sin datos sensibles: no muestra RUT, teléfono ni similitud
// facial; solo la asistencia del día de SU instalación y su evidencia básica.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getMandante, getZones } from "./api";
import { fmtDayLabel, fmtHHMM } from "./format";
import { STATUS_LABEL } from "./types";
import type { MandanteData } from "./types";

type MandanteWorker = MandanteData["workers"][number];
type MandanteEvidencia = MandanteWorker["evidencia"][number];

/** Píldora por estado de dotación (JORNADA_TERMINADA también es positivo). */
function estadoPillClass(estado: string): string {
  switch (estado) {
    case "PRESENTE":
    case "JORNADA_TERMINADA":
      return "pill pill-positive";
    case "EN_REVISION":
      return "pill pill-warning";
    default:
      return "pill pill-neutral"; // AUSENTE · PENDIENTE_SYNC
  }
}

export function MandantePortal({ initialZoneId }: { initialZoneId?: string }) {
  const zonesQ = useQuery({ queryKey: ["zones"], queryFn: getZones });
  const zones = zonesQ.data?.zones ?? [];

  const [zoneId, setZoneId] = useState<string | null>(initialZoneId ?? null);
  // Si el initialZoneId quedó obsoleto (zona eliminada), cae a la primera zona.
  const activeZoneId =
    zoneId !== null && zones.length > 0 && !zones.some((z) => z.id === zoneId)
      ? (zones[0]?.id ?? null)
      : (zoneId ?? zones[0]?.id ?? null);

  const dataQ = useQuery({
    queryKey: ["mandante", activeZoneId],
    queryFn: () => getMandante(activeZoneId as string),
    enabled: activeZoneId !== null,
  });
  const data = dataQ.data ?? null;

  function volverAlPanel() {
    window.location.hash = "#/panel";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header propio del portal */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-2.5 px-4">
          <span
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent)]"
            aria-hidden
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3.5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 8.5 3.5 3.5L13 4.5" />
            </svg>
          </span>
          <span className="text-[14px] font-semibold">AsisBot</span>
          <span className="truncate text-[13px] text-muted-foreground">· Portal del mandante</span>
          <span className="pill pill-neutral">Solo lectura</span>
          <span className="pill pill-warning ml-auto">DEMO</span>
        </div>
      </header>

      {/* Franja de aviso */}
      <p className="border-b border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-4 py-2 text-[12.5px] leading-snug text-[var(--pill-warning-ink)]">
        <span className="mx-auto block max-w-5xl">
          Vista de demostración con datos ficticios. Simula lo que vería el cliente mandante:
          asistencia del día por instalación, sin datos de otros clientes ni acceso al panel
          interno.
        </span>
      </p>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4">
        <button
          type="button"
          onClick={volverAlPanel}
          className="text-[12.5px] font-medium text-muted-foreground transition hover:text-foreground hover:underline"
        >
          ← Volver al panel (demo interno)
        </button>

        {/* Selector de instalación del cliente */}
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Selector de instalación">
          {zonesQ.isLoading ? (
            <>
              {[0, 1].map((i) => (
                <div key={i} className="h-8 w-36 rounded-md bg-[#f1f3f1]" aria-hidden />
              ))}
            </>
          ) : zones.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No hay instalaciones disponibles en la demo.
            </p>
          ) : (
            zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setZoneId(z.id)}
                aria-pressed={z.id === activeZoneId}
                className={`h-8 rounded-md border px-3 text-[13px] font-medium transition ${
                  z.id === activeZoneId
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-input bg-white text-foreground hover:bg-[#f4f6f4]"
                }`}
              >
                {z.name}
              </button>
            ))
          )}
        </div>

        {zonesQ.isError ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-[14px] font-medium">No se pudieron cargar las instalaciones.</p>
          </div>
        ) : dataQ.isError ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-[14px] font-medium">No se pudo cargar la asistencia del día.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Intenta nuevamente o elige otra instalación.
            </p>
          </div>
        ) : !data ? (
          <div className="space-y-4" aria-busy="true" aria-label="Cargando portal">
            <div className="h-20 rounded-lg border border-border bg-card" aria-hidden />
            <KpiSkeleton />
            <div className="h-72 rounded-lg border border-border bg-card" aria-hidden />
          </div>
        ) : (
          <>
            {/* Encabezado de la instalación */}
            <section aria-labelledby="mandante-instalacion-h">
              <h1 id="mandante-instalacion-h" className="text-[18px] font-semibold">
                Instalación: {data.zone.name}
              </h1>
              <p className="num mt-0.5 text-[13px] text-muted-foreground">
                {data.zone.address ?? "sin dirección"} · Día {fmtDayLabel(data.day)}
              </p>
            </section>

            {/* KPIs del día, texto dividido por hairlines */}
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4">
              <Kpi label="Esperados" value={data.summary.esperados} first />
              <Kpi label="Presentes" value={data.summary.presentes} />
              <Kpi label="Ausentes" value={data.summary.ausentes} />
              <Kpi label="Atrasos" value={data.summary.atrasos} />
            </div>

            {/* Dotación del día (tabla real, como la vista de reportes) */}
            <section
              aria-labelledby="mandante-dotacion-h"
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <header className="flex items-baseline justify-between px-4 pb-1 pt-3.5">
                <h2 id="mandante-dotacion-h" className="text-[16px] font-semibold">
                  Dotación del día
                </h2>
                <p className="num text-[12px] text-muted-foreground">
                  {data.workers.length} trabajadores asignados
                </p>
              </header>
              <div className="scroll-fine overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
                  <thead>
                    <tr className="text-[12px] text-muted-foreground">
                      <th className="px-4 py-2 text-left font-normal">Trabajador</th>
                      <th className="px-4 py-2 text-left font-normal">Cargo</th>
                      <th className="num px-4 py-2 text-right font-normal">Horario</th>
                      <th className="num px-4 py-2 text-right font-normal">Entrada</th>
                      <th className="num px-4 py-2 text-right font-normal">Salida</th>
                      <th className="px-4 py-2 text-left font-normal">Estado</th>
                      <th className="num px-4 py-2 text-right font-normal">Atraso</th>
                      <th className="px-4 py-2">
                        <span className="sr-only">Evidencia</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workers.map((w) => (
                      <MandanteRow key={w.id} w={w} />
                    ))}
                    {data.workers.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-[13px] text-muted-foreground"
                        >
                          No hay trabajadores asignados a esta instalación.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-[#eef0ee] px-4 py-2 text-[12px] text-muted-foreground">
                Estado por trabajador según la última marca válida del día. La evidencia es
                ilustrativa y no incluye datos personales del trabajador.
              </p>
            </section>
          </>
        )}
      </main>

      {/* Pie del portal */}
      <footer className="mt-auto border-t border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <p>
            Generado con datos ficticios · Vista de solo lectura: no permite editar marcas ni ver
            otros clientes.
          </p>
          <p>AsisBot · prototipo demo</p>
        </div>
      </footer>
    </div>
  );
}

function Kpi({
  label,
  value,
  first = false,
}: {
  label: string;
  value: number;
  first?: boolean;
}) {
  return (
    <div
      className={`flex flex-col justify-center px-4 py-3.5 ${!first ? "border-l border-[#eef0ee]" : ""} max-sm:[&:nth-child(2n)]:border-l-0 max-sm:[&:nth-child(n+3)]:border-t max-sm:[&:nth-child(n+3)]:border-[#eef0ee] max-sm:[&:nth-child(3)]:border-l-0`}
    >
      <p className="text-[12px] leading-none text-muted-foreground">{label}</p>
      <p className="num mt-1.5 text-[24px] font-semibold leading-none text-foreground">{value}</p>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div
      className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4"
      aria-hidden
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`px-4 py-3.5 ${i > 0 ? "border-l border-[#eef0ee]" : ""}`}>
          <div className="h-3 w-16 rounded bg-[#e7eae7]" />
          <div className="mt-2 h-6 w-10 rounded bg-[#e7eae7]" />
        </div>
      ))}
    </div>
  );
}

function MandanteRow({ w }: { w: MandanteWorker }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-t border-[#eef0ee] transition-colors hover:bg-[#f7f8f7]">
        <td className="px-4 py-2 font-medium">{w.name}</td>
        <td className="px-4 py-2 text-muted-foreground">{w.position}</td>
        <td className="num whitespace-nowrap px-4 py-2 text-right text-muted-foreground">
          {w.scheduleStart}–{w.scheduleEnd}
        </td>
        <td className="num px-4 py-2 text-right">{w.entrada ?? "—"}</td>
        <td className="num px-4 py-2 text-right">{w.salida ?? "—"}</td>
        <td className="px-4 py-2">
          <span className={estadoPillClass(w.estado)}>
            {STATUS_LABEL[w.estado] ?? w.estado}
          </span>
        </td>
        <td className="num px-4 py-2 text-right">
          {w.lateMin > 0 ? (
            <span className="pill pill-warning">{w.lateMin} min</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-2 text-right">
          {w.evidencia.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] hover:underline"
            >
              {open ? (
                <ChevronDown className="size-3.5" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5" aria-hidden />
              )}
              Ver evidencia
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-[#eef0ee] bg-[#fafbfa]">
          <td colSpan={8} className="px-4 py-3">
            <ul className="space-y-2.5">
              {w.evidencia.map((ev, i) => (
                <EvidenciaItem key={`${w.id}-ev-${i}`} ev={ev} />
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

/** Evidencia compacta por marca: tipo+hora, resultado, foto ilustrativa y lugar. */
function EvidenciaItem({ ev }: { ev: MandanteEvidencia }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {/* Foto ilustrativa (no es una persona real) */}
      <img
        src="/demo/selfie-carlos.png"
        alt="Evidencia ilustrativa (foto no real)"
        className="size-9 rounded-md object-cover"
      />
      <span className="text-[13px] font-medium">
        {ev.type === "ENTRADA" ? "Entrada" : "Salida"} {fmtHHMM(ev.timestamp)}
      </span>
      {ev.status === "EN_REVISION" ? (
        <span className="pill pill-warning">{STATUS_LABEL[ev.status] ?? ev.status}</span>
      ) : ev.status === "PENDIENTE_SYNC" ? (
        <span className="pill pill-neutral">{STATUS_LABEL[ev.status] ?? ev.status}</span>
      ) : (
        <span className="text-[12.5px] text-muted-foreground">
          · {STATUS_LABEL[ev.status] ?? ev.status}
        </span>
      )}
      <span className="text-[12.5px] text-muted-foreground">
        {ev.distanceM !== null
          ? `a ${ev.distanceM} m del centro de la zona`
          : "sin ubicación"}
        {ev.latApprox !== null && ev.lngApprox !== null && (
          <> · ({ev.latApprox.toFixed(3)}, {ev.lngApprox.toFixed(3)})</>
        )}
      </span>
      {ev.syncAt && (
        <span className="text-[12px] text-muted-foreground">
          · sincronizada a las {fmtHHMM(ev.syncAt)} (sin señal)
        </span>
      )}
    </li>
  );
}
