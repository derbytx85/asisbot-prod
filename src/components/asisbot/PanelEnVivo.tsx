"use client";

// ─── Panel en vivo ──────────────────────────────────────────────────────────
// Pregunta de la pantalla: ¿cómo está la dotación hoy?
// Lo más grande: la lista de trabajadores con su línea de jornada.
// El mapa con las geocercas y las marcaciones del día va al lado.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, WifiOff } from "lucide-react";
import { getDashboard } from "./api";
import { Avatar } from "./Avatar";
import { StatusPill } from "./StatusPill";
import { JornadaStrip } from "./JornadaStrip";
import type { MapPoint } from "./MapViewClientTypes";
import MapView from "./MapViewClient";
import { fmtHHMM, chileWallMinutes } from "./format";
import type { DashboardWorkerRow } from "./types";

function useNowMin() {
  // minutos de pared chilena actuales, refrescados al montar
  const [now] = useState(() => new Date().toISOString());
  return chileWallMinutes(now);
}

export function PanelEnVivo({ onVerRevision }: { onVerRevision: () => void }) {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } =
    useQuery({
      queryKey: ["dashboard"],
      queryFn: getDashboard,
      refetchInterval: 15000,
    });
  const nowMin = useNowMin();

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando panel">
        <KpiSkeleton />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="h-72 animate-none rounded-lg border border-border bg-card" />
          <div className="h-72 rounded-lg border border-border bg-card" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-[14px] font-medium">No se pudo cargar el panel.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {error instanceof Error ? error.message : "Verifica la conexión con la API e inténtalo otra vez."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { kpis, workers, zones, todayCheckins } = data;
  const workerById = new Map(workers.map((w) => [w.id, w]));
  const points: MapPoint[] = todayCheckins
    .filter((c) => c.lat !== null && c.lng !== null)
    .map((c) => ({
      id: c.id,
      lat: c.lat,
      lng: c.lng,
      status: c.status,
      type: c.type,
      timestamp: c.timestamp,
      workerName: workerById.get(c.workerId)?.name ?? "Trabajador",
    }));

  return (
    <div className="space-y-4">
      {/* KPIs: un contenedor dividido por hairlines (skill §5) */}
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Presentes" value={kpis.presentes} first />
        <Kpi
          label="En revisión"
          value={kpis.enRevision}
          action={kpis.enRevision > 0 ? onVerRevision : undefined}
          actionLabel="Revisar"
        />
        <Kpi label="Ausentes" value={kpis.ausentes} />
        <Kpi label="Jornada terminada" value={kpis.jornadaTerminada} />
        <Kpi label="Alertas pendientes" value={kpis.alertasPendientes} />
      </div>

      {/* Marcas sin señal esperando sincronización (mejora §4) */}
      {kpis.pendientesSync > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-3 py-2 text-[12.5px] text-[var(--pill-warning-ink)]">
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">{kpis.pendientesSync} marca{kpis.pendientesSync > 1 ? "s" : ""} guardada{kpis.pendientesSync > 1 ? "s" : ""} sin señal</strong>: {kpis.pendientesSync > 1 ? "están" : "está"} en el teléfono del trabajador con su hora original y se envía{kpis.pendientesSync > 1 ? "n" : ""} cuando vuelva la cobertura.
          </span>
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Dotación de hoy con líneas de jornada */}
        <section aria-labelledby="dotacion-h" className="rounded-lg border border-border bg-card">
          <header className="flex items-baseline justify-between px-4 pb-1 pt-3.5">
            <h2 id="dotacion-h" className="text-[16px] font-semibold">
              Dotación de hoy
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {kpis.marcacionesHoy} marcaciones · {kpis.dotacion} trabajadores activos
            </p>
          </header>
          <ul className="divide-y divide-[#eef0ee]">
            {workers.map((w) => (
              <WorkerRow key={w.id} w={w} nowMin={nowMin} />
            ))}
            {workers.length === 0 && (
              <li className="m-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
                No hay trabajadores activos. Crea uno en la vista Trabajadores.
              </li>
            )}
          </ul>
        </section>

        {/* Mapa del día */}
        <div className="space-y-4">
          <section aria-labelledby="mapa-h" className="rounded-lg border border-border bg-card p-3">
            <header className="flex items-baseline justify-between px-1 pb-2 pt-1">
              <h2 id="mapa-h" className="text-[16px] font-semibold">
                Mapa del día
              </h2>
              <span className="text-[12px] text-muted-foreground">
                {points.length} con ubicación
              </span>
            </header>
            <MapView zones={zones} points={points} className="h-[360px]" />
            <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-2 text-[12px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[var(--accent)]" /> Geocerca autorizada
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#0e7a47] ring-2 ring-white" /> Aprobada
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#b45309] ring-2 ring-white" /> En revisión
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#c4242a] ring-2 ring-white" /> Rechazada
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#8a938a] ring-2 ring-white" /> Por sincronizar (sin señal)
              </li>
            </ul>
          </section>
        </div>
      </div>

      {/* frescura de datos */}
      <div className="flex items-center justify-end gap-2 text-[12px] text-muted-foreground">
        <span className="num">Actualizado {fmtHHMM(dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : data.generatedAt)}</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-white px-2 py-1 transition hover:bg-[#f4f6f4]"
        >
          <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
          Actualizar
        </button>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  first = false,
  action,
  actionLabel,
}: {
  label: string;
  value: number;
  first?: boolean;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div
      className={`flex flex-col justify-center px-4 py-3.5 ${!first ? "border-l border-[#eef0ee]" : ""} max-sm:[&:nth-child(2n)]:border-l-0 max-sm:[&:nth-child(n+3)]:border-t max-sm:[&:nth-child(n+3)]:border-[#eef0ee] max-sm:[&:nth-child(3)]:border-l-0`}
    >
      <p className="text-[12px] leading-none text-muted-foreground">{label}</p>
      <p className="num mt-1.5 text-[24px] font-semibold leading-none text-foreground">
        {value}
      </p>
      {action && value > 0 && (
        <button
          type="button"
          onClick={action}
          className="mt-1.5 w-fit text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 lg:grid-cols-5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={`px-4 py-3.5 ${i > 0 ? "border-l border-[#eef0ee]" : ""}`}>
          <div className="h-3 w-20 rounded bg-[#e7eae7]" />
          <div className="mt-2 h-6 w-10 rounded bg-[#e7eae7]" />
        </div>
      ))}
    </div>
  );
}

function WorkerRow({ w, nowMin }: { w: DashboardWorkerRow; nowMin: number }) {
  const alerta = w.pendingAlertTypes[0];
  const hasPendingSync = (w.pendingSyncTypes?.length ?? 0) > 0;
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Avatar name={w.name} hue={w.avatarHue} size={32} />
      <div className="min-w-0 w-44">
        <p className="truncate text-[14px] font-medium leading-tight">{w.name}</p>
        <p className="truncate text-[12px] leading-tight text-muted-foreground">
          {w.position} · {w.zoneName ?? "sin zona"}
        </p>
      </div>
      <div className="w-32 shrink-0">
        <StatusPill status={w.status} />
        {hasPendingSync && (
          <span className="pill pill-neutral mt-1 inline-flex items-center gap-1">
            <WifiOff className="size-2.5" aria-hidden />
            sin señal
          </span>
        )}
      </div>
      <div className="hidden min-w-0 flex-1 md:block">
        <JornadaStrip
          scheduleStart={w.scheduleStart}
          scheduleEnd={w.scheduleEnd}
          entrada={w.entrada}
          salida={w.salida}
          nowMin={nowMin}
        />
      </div>
      <div className="w-28 shrink-0 text-right">
        {w.entrada ? (
          <>
            <p className="num text-[13px] leading-tight">
              <span className="text-muted-foreground">E</span> {fmtHHMM(w.entrada)}
              {w.salida && (
                <>
                  {" · "}
                  <span className="text-muted-foreground">S</span> {fmtHHMM(w.salida)}
                </>
              )}
            </p>
            <p className="text-[11px] leading-tight text-muted-foreground">
              {w.entradaSimilarity !== null ? `similitud ${w.entradaSimilarity}%` : "—"}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">—</p>
        )}
      </div>
    </li>
  );
}
