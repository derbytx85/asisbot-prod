"use client";

// ─── Alertas del día ────────────────────────────────────────────────────────
// Filtro por tipo y estado. La IA solo sugiere: resolver una alerta es
// siempre una acción humana registrada (mejora §5: la IA alerta, no sanciona).

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAlerts, resolveAlert } from "./api";
import { Avatar } from "./Avatar";
import { StatusPill } from "./StatusPill";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtWhen } from "./format";
import { ALERT_LABEL, type Alert } from "./types";

const TIPOS = [
  "FUERA_ZONA",
  "SUPLANTACION",
  "DUPLICADA",
  "ATRASO",
  "SIN_UBICACION",
  "SIN_ENTRADA",
  "FOTO_GALERIA",
  "INCOHERENTE",
  "SYNC_TARDE",
] as const;

export function AlertasView() {
  const qc = useQueryClient();
  const [estado, setEstado] = useState<"PENDIENTE" | "RESUELTA" | "">("");
  const [tipo, setTipo] = useState<string>("");
  const [scope, setScope] = useState<"today" | "all">("today");
  const [resolving, setResolving] = useState<Alert | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["alerts", estado, tipo, scope],
    queryFn: () => getAlerts({ status: estado || undefined, type: tipo || undefined, scope }),
    refetchInterval: 20000,
  });

  const alerts = data?.alerts ?? [];
  const pendientes = alerts.filter((a) => a.status === "PENDIENTE").length;
  // Contador REAL de falsos positivos (mejora §5): viene siempre en la
  // respuesta de getAlerts, sin importar el filtro activo. "—" mientras carga.
  const fp = data?.fpSummary;

  async function confirmResolve() {
    if (!resolving) return;
    setBusy(true);
    try {
      await resolveAlert(resolving.id, note.trim() || undefined);
      toast.success("Alerta resuelta", { description: "Quedó registrada con tu usuario y nota." });
      setResolving(null);
      setNote("");
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al resolver la alerta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mejora §5: anti-trampa honesto — la IA alerta, no sanciona */}
      <section aria-labelledby="fp-h" className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="min-w-0 flex-1">
            <h2 id="fp-h" className="text-[14px] font-semibold">
              La IA alerta, no sanciona
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              Ninguna alerta cambia el estado de una marcación por sí sola: toda decisión la
              toma una persona autorizada y queda auditada.
            </p>
          </div>
          <div className="min-w-0 sm:max-w-[54%] sm:border-l sm:border-border sm:pl-6">
            <p className="text-[13.5px] font-medium">
              Falsos positivos: <span className="num tabular-nums">{fp ? fp.falsePositives : "—"}</span> de <span className="num tabular-nums">{fp ? fp.resolved : "—"}</span> alertas de anomalía resueltas (<span className="num tabular-nums">{fp ? `${fp.ratePct}%` : "—"}</span>)
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              Meta del piloto: &lt;20% en la semana 4 (proyectado, no observado). La demo siembra
              anomalías a propósito: esta tasa no representa un entorno real.
            </p>
          </div>
        </div>
      </section>

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as typeof estado)}
          aria-label="Filtrar por estado"
          className="h-8 rounded-md border border-input bg-white px-2.5 text-[13px]"
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="RESUELTA">Resueltas</option>
        </select>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          aria-label="Filtrar por tipo"
          className="h-8 rounded-md border border-input bg-white px-2.5 text-[13px]"
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ALERT_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "today" | "all")}
          aria-label="Filtrar por período"
          className="h-8 rounded-md border border-input bg-white px-2.5 text-[13px]"
        >
          <option value="today">Hoy</option>
          <option value="all">Historial</option>
        </select>
        <p className="ml-auto text-[12.5px] text-muted-foreground">
          {alerts.length} alerta{alerts.length === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-foreground">{pendientes} pendiente{pendientes === 1 ? "" : "s"}</span>
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card" aria-label="Lista de alertas">
        {isLoading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-md bg-[#f1f3f1]" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="m-4 rounded-md border border-dashed border-border px-3 py-8 text-center">
            <p className="text-[14px] font-medium">Sin alertas para este filtro.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Las alertas se generan automáticamente ante marcaciones irregulares.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#eef0ee]">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar
                  name={a.checkIn?.worker?.name ?? "?"}
                  hue={a.checkIn?.worker?.avatarHue ?? 150}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <p className="text-[13.5px] font-medium">{a.checkIn?.worker?.name}</p>
                    <span className="pill pill-neutral">{ALERT_LABEL[a.type] ?? a.type}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug">{a.message}</p>
                  {a.status === "RESUELTA" && a.resolutionNote && (
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      “{a.resolutionNote}” — {a.resolvedBy}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="num hidden text-[12px] text-muted-foreground sm:block">
                    {fmtWhen(a.createdAt)}
                  </span>
                  <StatusPill status={a.status} />
                  {a.status === "PENDIENTE" && (
                    <button
                      type="button"
                      onClick={() => {
                        setResolving(a);
                        setNote("");
                      }}
                      className="h-8 rounded-md border border-input bg-white px-2.5 text-[13px] font-medium transition hover:bg-[#f4f6f4]"
                    >
                      Resolver
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolver alerta</DialogTitle>
            <DialogDescription className="text-[13.5px] leading-snug text-muted-foreground">
              {resolving?.checkIn?.worker?.name}: “{resolving?.message}”
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="res-note" className="text-[14px] font-medium">
              Nota de resolución <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              id="res-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Se contactó al trabajador y confirmó su ubicación."
              className="min-h-20 w-full resize-none rounded-md border border-input bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--accent)]/50"
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setResolving(null)}
              className="h-9 rounded-md border border-input bg-white px-3 text-[13.5px] font-medium transition hover:bg-[#f4f6f4]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmResolve}
              disabled={busy}
              className="h-9 rounded-md bg-primary px-3 text-[13.5px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Guardando…" : "Marcar resuelta"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
