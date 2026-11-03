"use client";

// ─── Mis marcas (vista del trabajador, mejora §1) ───────────────────────────
// En la demo, quien revisa toma la identidad de un trabajador y ve SOLO sus
// propias marcas: consentimiento informado, línea de privacidad y el detalle
// de cada marcación en lenguaje simple (sin selfies, sin datos de otros).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, ShieldCheck } from "lucide-react";
import { getCheckins, getWorkers } from "./api";
import { Avatar } from "./Avatar";
import { StatusPill } from "./StatusPill";
import { fmtHHMM, fmtWhen } from "./format";
import { PRIVACY_LINE } from "./types";
import type { CheckIn, Worker } from "./types";

/** Fecha larga en hora de Chile: "27 de octubre de 2026". */
function fmtFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** 6200 → "6,2 km" · 114 → "114 m" (decimal con coma, es-CL). */
function fmtDistancia(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(m)} m`;
}

export function MisMarcas() {
  const workersQ = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const [workerId, setWorkerId] = useState<string | null>(null);

  const activos: Worker[] = (workersQ.data?.workers ?? []).filter((w) => w.active);
  const activeWorker = activos.find((w) => w.id === workerId) ?? activos[0] ?? null;
  const wid = activeWorker?.id ?? null;

  const checkinsQ = useQuery({
    queryKey: ["checkins", "mine", wid],
    queryFn: () => getCheckins({ workerId: wid as string, scope: "all" }),
    enabled: wid !== null,
  });
  const checkins = checkinsQ.data?.checkins ?? [];

  function solicitarEliminacion() {
    toast.info(
      "En producción, tu solicitud se enviaría a RR.HH. y la empresa debe responder dentro del plazo legal. (Demo)",
    );
  }

  return (
    <div className="space-y-4">
      {/* Identidad de la demo */}
      <section aria-labelledby="mis-marcas-identidad-h" className="rounded-lg border border-border bg-card p-4">
        <h2 id="mis-marcas-identidad-h" className="text-[16px] font-semibold">
          En esta demo tomas la identidad de:
        </h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {workersQ.isLoading ? (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 w-32 rounded-full bg-[#f1f3f1]" aria-hidden />
              ))}
            </>
          ) : activos.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No hay trabajadores activos en la demo.
            </p>
          ) : (
            activos.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWorkerId(w.id)}
                aria-pressed={w.id === activeWorker?.id}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[12.5px] font-medium transition ${
                  w.id === activeWorker?.id
                    ? "border-[#0e7a47]/50 bg-[#eaf5ef] text-[#0b5c37]"
                    : "border-border bg-white text-foreground hover:bg-[#f4f6f4]"
                }`}
              >
                <Avatar name={w.name} hue={w.avatarHue} size={24} />
                {w.name.split(" ").slice(0, 2).join(" ")}
              </button>
            ))
          )}
        </div>

        {/* Consentimiento informado (mejora §1) */}
        {activeWorker && (
          activeWorker.consent ? (
            <div className="mt-4 flex flex-col gap-2 rounded-md border border-border bg-[#fafbfa] p-3 sm:flex-row sm:items-start sm:gap-3">
              <ShieldCheck className="size-5 shrink-0 text-[var(--accent)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">
                  Consentimiento aceptado · versión {activeWorker.consent.version} ·{" "}
                  {fmtFechaLarga(activeWorker.consent.acceptedAt)}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Puedes solicitar la eliminación de tus datos cuando quieras.
                </p>
              </div>
              <button
                type="button"
                onClick={solicitarEliminacion}
                className="h-8 shrink-0 rounded-md border border-input bg-white px-3 text-[12.5px] font-medium transition hover:bg-[#f4f6f4]"
              >
                Solicitar eliminación de mis datos (demo)
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] p-3">
              <p className="text-[13px] font-medium text-[var(--pill-warning-ink)]">
                Aún no has aceptado el consentimiento de privacidad — ve al Simulador WhatsApp
                para aceptarlo.
              </p>
            </div>
          )
        )}
      </section>

      {/* Lista de marcas del trabajador */}
      <section aria-labelledby="mis-marcas-h" className="rounded-lg border border-border bg-card">
        <header className="flex items-baseline justify-between px-4 pb-1 pt-3.5">
          <h2 id="mis-marcas-h" className="text-[16px] font-semibold">
            Mis marcas{" "}
            {!checkinsQ.isLoading && (
              <span className="num text-[13px] font-normal text-muted-foreground">
                ({checkins.length})
              </span>
            )}
          </h2>
          {activeWorker && (
            <p className="text-[12px] text-muted-foreground">
              {activeWorker.name} · {activeWorker.zone?.name ?? "sin zona asignada"}
            </p>
          )}
        </header>

        {workersQ.isError ? (
          <p className="px-4 pb-4 text-[13px] text-[var(--destructive)]">
            No se pudo cargar la lista de trabajadores.
          </p>
        ) : checkinsQ.isError ? (
          <p className="px-4 pb-4 text-[13px] text-[var(--destructive)]">
            No se pudieron cargar tus marcas. Intenta de nuevo.
          </p>
        ) : checkinsQ.isLoading || !activeWorker ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-md bg-[#f1f3f1]" aria-hidden />
            ))}
          </div>
        ) : checkins.length === 0 ? (
          <p className="m-4 rounded-md border border-dashed border-border px-3 py-8 text-center text-[13px] text-muted-foreground">
            Aún no tienes marcas registradas.
          </p>
        ) : (
          <ul className="divide-y divide-[#eef0ee]">
            {checkins.map((c) => (
              <MarcaRow key={c.id} c={c} zoneName={activeWorker.zone?.name ?? null} />
            ))}
          </ul>
        )}

        {/* Privacidad: siempre visible en esta vista (mejora §1) */}
        <p className="flex items-start gap-2 border-t border-[#eef0ee] px-4 py-2.5 text-[12px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
          {PRIVACY_LINE}
        </p>
      </section>
    </div>
  );
}

function MarcaRow({ c, zoneName }: { c: CheckIn; zoneName: string | null }) {
  const pendienteSync = c.status === "PENDIENTE_SYNC";

  let lugar: string;
  if (zoneName && c.distanceM !== null) {
    lugar = `a ${fmtDistancia(c.distanceM)} de ${zoneName}`;
  } else if (zoneName) {
    lugar = zoneName;
  } else {
    lugar = "sin ubicación compartida";
  }

  return (
    <li className="px-4 py-3">
      {/* Línea 1: tipo + cuándo + estado */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-[13.5px] font-medium">{c.type === "ENTRADA" ? "Entrada" : "Salida"}</span>
        <span className="num text-[13px] text-muted-foreground">{fmtWhen(c.timestamp)}</span>
        <StatusPill status={c.status} className="ml-auto" />
      </div>

      {/* Línea 2: lugar aproximado */}
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{lugar}</p>

      {/* Marca sin señal: conservó su hora original */}
      {pendienteSync && (
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">
          Guardada en tu teléfono (sin señal). Conserva tu hora original: {fmtHHMM(c.timestamp)}.
        </p>
      )}
      {c.syncAt && (
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Marca de las {fmtHHMM(c.timestamp)}, sincronizada a las {fmtHHMM(c.syncAt)} (sin señal).
        </p>
      )}

      {/* Motivo del sistema, salvo que esté aprobada */}
      {c.reason && c.status !== "APROBADA" && (
        <p className="mt-1.5 text-[13px] leading-snug">{c.reason}</p>
      )}

      {/* Explicación del propio trabajador */}
      {c.workerNote && (
        <p className="mt-1.5 text-[13px] leading-snug italic">
          Tu explicación: «{c.workerNote}»
        </p>
      )}

      {/* Auditoría de correcciones */}
      {c.corrections?.map((corr) => (
        <p
          key={corr.id}
          className="mt-1.5 flex items-start gap-1.5 text-[12px] text-muted-foreground"
        >
          <History className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Corregida: {corr.field === "timestamp" ? "hora" : "estado"} {corr.oldValue} →{" "}
            {corr.newValue} · {corr.reason}
          </span>
        </p>
      ))}
    </li>
  );
}
