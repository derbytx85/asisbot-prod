"use client";

// ─── Cola de revisión ───────────────────────────────────────────────────────
// Solo las marcaciones EN_REVISION sin revisar. Toda decisión humana queda
// registrada con usuario, fecha y motivo (trazabilidad, brief §3.3).
// Corrección sin volver a Excel (mejora §2): ajustar hora y/o estado con
// motivo obligatorio. La marca original nunca se borra: cada cambio queda
// en el historial de correcciones (quién, cuándo, valor anterior y nuevo).

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  History,
  MapPin,
  MessageSquareQuote,
  PencilLine,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { correctCheckin, getCheckins, getCorrections, reviewCheckin } from "./api";
import { Avatar } from "./Avatar";
import { StatusPill } from "./StatusPill";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtHHMM, fmtWhen } from "./format";
import { ALERT_LABEL, STATUS_LABEL, type CheckIn, type Correction } from "./types";
import { chileInstant, chileParts } from "@/lib/tz";

type Decision = "APROBADA" | "RECHAZADA";

/** Fila del historial de correcciones; la relación con la marca se llama `checkIn`. */
type CorrectionRow = Correction & {
  checkIn: {
    id: string;
    type: CheckIn["type"];
    timestamp: string;
    worker?: { id: string; name: string; avatarHue: number; position: string };
  };
};

/** Borrador del diálogo de corrección; se fija al abrir (sin useEffect). */
interface CorrectDraft {
  checkin: CheckIn;
  /** Valor del input datetime-local, en hora de pared Chile. */
  time: string;
  /** Valor al abrir, para detectar si la hora cambió. */
  initialTime: string;
  /** "" = mantener el estado actual. */
  status: "" | "APROBADA" | "RECHAZADA";
  reason: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ISO → valor para <input type="datetime-local"> en hora de pared chilena. */
function isoToChileInput(iso: string): string {
  const p = chileParts(new Date(iso));
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Valor de datetime-local (hora Chile) → ISO UTC; null si es inválido. */
function chileInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  return chileInstant(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])).toISOString();
}

/** Minutos entre la marca original y su sincronización (Math.round). */
function syncLateMin(c: CheckIn): number {
  if (!c.syncAt) return 0;
  return Math.round((new Date(c.syncAt).getTime() - new Date(c.timestamp).getTime()) / 60000);
}

/** Texto del cambio auditado: "hora 08:47 → 08:00" · "estado En revisión → Aprobada". */
function correctionChangeText(c: Correction): string {
  if (c.field === "timestamp") return `hora ${c.oldValue} → ${c.newValue}`;
  return `estado ${STATUS_LABEL[c.oldValue] ?? c.oldValue} → ${STATUS_LABEL[c.newValue] ?? c.newValue}`;
}

export function ColaRevision() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["checkins", "revision"],
    queryFn: () => getCheckins({ status: "EN_REVISION" }),
    refetchInterval: 20000,
  });
  const [deciding, setDeciding] = useState<{ checkin: CheckIn; decision: Decision } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Corrección auditada desde el panel (mejora §2)
  const [correctDraft, setCorrectDraft] = useState<CorrectDraft | null>(null);
  const [correctBusy, setCorrectBusy] = useState(false);

  const pending = (data?.checkins ?? []).filter((c) => !c.reviewedBy);
  const { data: reviewedData } = useQuery({
    queryKey: ["checkins", "reviewed"],
    queryFn: () => getCheckins({ reviewed: "1" }),
    refetchInterval: 20000,
  });
  const reviewed = (reviewedData?.checkins ?? []).slice(0, 8);

  // Historial de correcciones (mejora §2, auditoría)
  const { data: correctionsData } = useQuery({
    queryKey: ["corrections"],
    queryFn: getCorrections,
    refetchInterval: 30000,
  });
  const corrections: CorrectionRow[] = correctionsData?.corrections ?? [];

  const timeChanged = correctDraft !== null && correctDraft.time !== correctDraft.initialTime;
  const timeValid =
    !timeChanged || (correctDraft !== null && chileInputToIso(correctDraft.time) !== null);
  const statusChanged =
    correctDraft !== null &&
    correctDraft.status !== "" &&
    correctDraft.status !== correctDraft.checkin.status;
  const canCorrect =
    correctDraft !== null &&
    correctDraft.reason.trim().length >= 3 &&
    (timeChanged || statusChanged) &&
    timeValid;

  async function confirm() {
    if (!deciding || note.trim().length < 3) return;
    setBusy(true);
    try {
      await reviewCheckin(deciding.checkin.id, { decision: deciding.decision, note: note.trim() });
      toast.success(
        deciding.decision === "APROBADA" ? "Marcación aprobada" : "Marcación rechazada",
        { description: "La decisión quedó registrada con usuario, fecha y motivo." },
      );
      setDeciding(null);
      setNote("");
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar la decisión.");
    } finally {
      setBusy(false);
    }
  }

  /** Abre el diálogo de corrección con los valores actuales de la marca. */
  function openCorrect(c: CheckIn) {
    const t = isoToChileInput(c.timestamp);
    setCorrectDraft({ checkin: c, time: t, initialTime: t, status: "", reason: "" });
  }

  async function confirmCorrect() {
    if (!correctDraft || !canCorrect) return;
    setCorrectBusy(true);
    try {
      const newTimestamp = timeChanged ? chileInputToIso(correctDraft.time) : null;
      const newStatus = statusChanged ? correctDraft.status : null;
      await correctCheckin(correctDraft.checkin.id, {
        newTimestamp,
        newStatus: newStatus === "" ? null : newStatus,
        reason: correctDraft.reason.trim(),
      });
      toast.success("Marcación corregida", {
        description: "El cambio quedó auditado: quién, cuándo, valor anterior y nuevo.",
      });
      setCorrectDraft(null);
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar la corrección.");
    } finally {
      setCorrectBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="cola-h" className="rounded-lg border border-border bg-card">
        <header className="flex items-baseline justify-between px-4 pb-1 pt-3.5">
          <h2 id="cola-h" className="text-[16px] font-semibold">
            Marcaciones por revisar
          </h2>
          <p className="text-[12px] text-muted-foreground">
            {pending.length > 0 ? `${pending.length} pendiente${pending.length > 1 ? "s" : ""}` : "nada por ahora"}
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 rounded-md bg-[#f1f3f1]" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="m-4 rounded-md border border-dashed border-border px-3 py-8 text-center">
            <p className="text-[14px] font-medium">La cola está al día.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Cuando una marcación quede en revisión (fuera de zona, suplantación, sin
              ubicación), aparecerá aquí.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#eef0ee]">
            {pending.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar name={c.worker?.name ?? "?"} hue={c.worker?.avatarHue ?? 150} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[14px] font-medium">{c.worker?.name}</p>
                      <span className="text-[12px] text-muted-foreground">
                        {c.worker?.position}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-foreground">
                      {c.reason}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                      <span className="num">
                        {c.type === "ENTRADA" ? "Entrada" : "Salida"} · {fmtWhen(c.timestamp)}
                      </span>
                      <span className="num inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden />
                        {c.lat !== null ? `${c.lat.toFixed(4)}, ${c.lng?.toFixed(4)}` : "sin ubicación"}
                      </span>
                      <span className="num">
                        {c.similarity !== null ? `similitud ${c.similarity}%` : "sin selfie"}
                      </span>
                    </div>
                    {c.syncAt && (
                      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                        Marca original <span className="num font-medium text-foreground">{fmtHHMM(c.timestamp)}</span> · sincronizada <span className="num font-medium text-foreground">{fmtHHMM(c.syncAt)}</span> (<span className="num">{syncLateMin(c)}</span> min después, sin señal)
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(c.alerts ?? []).map((a) => (
                        <span key={a.id} className="pill pill-warning">
                          {ALERT_LABEL[a.type] ?? a.type}
                        </span>
                      ))}
                    </div>
                    {c.workerNote && (
                      <div className="mt-1.5 flex items-start gap-2 rounded-md border border-border bg-[#f7f9f7] px-2.5 py-2">
                        <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
                        <p className="min-w-0 text-[12.5px] leading-snug">
                          <span className="font-medium">El trabajador explicó:</span> «{c.workerNote}»
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeciding({ checkin: c, decision: "APROBADA" });
                        setNote("");
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-white px-2.5 text-[13px] font-medium transition hover:bg-[#f4f6f4]"
                    >
                      <ShieldCheck className="size-3.5 text-[var(--accent)]" aria-hidden />
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeciding({ checkin: c, decision: "RECHAZADA" });
                        setNote("");
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-white px-2.5 text-[13px] font-medium text-[var(--destructive)] transition hover:bg-[#fff5f4]"
                    >
                      <ShieldX className="size-3.5" aria-hidden />
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => openCorrect(c)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-white px-2.5 text-[13px] font-medium transition hover:bg-[#f4f6f4]"
                    >
                      <PencilLine className="size-3.5 text-muted-foreground" aria-hidden />
                      Corregir
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Historial de decisiones (auditoría) */}
      <section aria-labelledby="auditoria-h" className="rounded-lg border border-border bg-card">
        <header className="px-4 pb-1 pt-3.5">
          <h2 id="auditoria-h" className="text-[16px] font-semibold">
            Decisiones recientes
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Cada decisión queda auditada: quién, cuándo y por qué.
          </p>
        </header>
        {reviewed.length === 0 ? (
          <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground">
            Aún no hay decisiones registradas hoy.
          </p>
        ) : (
          <ul className="divide-y divide-[#eef0ee]">
            {reviewed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar name={c.worker?.name ?? "?"} hue={c.worker?.avatarHue ?? 150} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px]">
                    <span className="font-medium">{c.worker?.name}</span>{" "}
                    <span className="text-muted-foreground">
                      · {c.type === "ENTRADA" ? "entrada" : "salida"} {fmtWhen(c.timestamp)}
                    </span>
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    “{c.reviewNote}” — {c.reviewedBy}
                  </p>
                </div>
                <StatusPill status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Correcciones recientes (mejora §2: auditoría de cambios, la marca original nunca se borra) */}
      <section aria-labelledby="correcciones-h" className="rounded-lg border border-border bg-card">
        <header className="px-4 pb-1 pt-3.5">
          <h2 id="correcciones-h" className="text-[16px] font-semibold">
            Correcciones recientes
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            La marca original nunca se borra: cada cambio queda registrado con motivo.
          </p>
        </header>
        {corrections.length === 0 ? (
          <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground">
            Aún no hay correcciones registradas.
          </p>
        ) : (
          <ul className="divide-y divide-[#eef0ee]">
            {corrections.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar name={k.checkIn.worker?.name ?? "?"} hue={k.checkIn.worker?.avatarHue ?? 150} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px]">
                    <span className="font-medium">{k.checkIn.worker?.name}</span>{" "}
                    <span className="text-muted-foreground">· {k.checkIn.type === "ENTRADA" ? "entrada" : "salida"}</span>{" "}
                    <span className="num">{correctionChangeText(k)}</span>
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    “{k.reason}” — {k.correctedBy}
                  </p>
                </div>
                <span className="num shrink-0 text-[12px] text-muted-foreground">
                  {fmtWhen(k.correctedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Diálogo de decisión */}
      <Dialog open={!!deciding} onOpenChange={(o) => !o && setDeciding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deciding?.decision === "APROBADA" ? "Aprobar marcación" : "Rechazar marcación"}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-snug text-muted-foreground">
              {deciding?.checkin.worker?.name} ·{" "}
              {deciding?.checkin.type === "ENTRADA" ? "entrada" : "salida"}{" "}
              {fmtWhen(deciding?.checkin.timestamp ?? null)}. La decisión queda registrada
              con tu usuario, la fecha y el motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="rev-note" className="text-[14px] font-medium">
              Motivo <span className="text-muted-foreground">(obligatorio)</span>
            </label>
            <Textarea
              id="rev-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                deciding?.decision === "APROBADA"
                  ? "Ej: Trabajador identificable en la selfie; se aprueba la marcación."
                  : "Ej: La selfie no corresponde al trabajador; se solicita re-marcación."
              }
              className="min-h-24 resize-none"
            />
            {note.trim().length < 3 && (
              <p className="text-[12px] text-muted-foreground">
                Escribe al menos 3 caracteres para dejar constancia.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setDeciding(null)}
              className="h-9 rounded-md border border-input bg-white px-3 text-[13.5px] font-medium transition hover:bg-[#f4f6f4]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy || note.trim().length < 3}
              className={`h-9 rounded-md px-3 text-[13.5px] font-medium text-white transition disabled:opacity-40 ${
                deciding?.decision === "APROBADA" ? "bg-[var(--accent)] hover:bg-[#0c6a3e]" : "bg-[var(--destructive)] hover:bg-[#a81f24]"
              }`}
            >
              {busy ? "Registrando…" : confirmingLabel(deciding?.decision)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de corrección (mejora §2): hora y/o estado con motivo obligatorio */}
      <Dialog open={!!correctDraft} onOpenChange={(o) => !o && setCorrectDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Corregir marcación</DialogTitle>
            <DialogDescription className="text-[13px] leading-snug text-muted-foreground">
              Ajusta solo lo que necesite corrección; cada cambio queda auditado.
            </DialogDescription>
          </DialogHeader>

          {/* valores actuales */}
          <div className="rounded-md border border-border bg-[#f7f9f7] px-3 py-2.5">
            <div className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1 text-[13px]">
              <span className="text-muted-foreground">Trabajador</span>
              <span className="font-medium">{correctDraft?.checkin.worker?.name ?? "—"}</span>
              <span className="text-muted-foreground">Tipo</span>
              <span>{correctDraft?.checkin.type === "SALIDA" ? "Salida" : "Entrada"}</span>
              <span className="text-muted-foreground">Hora actual</span>
              <span className="num">{fmtWhen(correctDraft?.checkin.timestamp ?? null)}</span>
              <span className="text-muted-foreground">Estado actual</span>
              <span>{correctDraft ? (STATUS_LABEL[correctDraft.checkin.status] ?? correctDraft.checkin.status) : "—"}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13.5px] font-medium">Nueva hora</span>
              <input
                type="datetime-local"
                value={correctDraft?.time ?? ""}
                onChange={(e) => correctDraft && setCorrectDraft({ ...correctDraft, time: e.target.value })}
                aria-label="Nueva hora de la marcación"
                className="h-9 w-full rounded-md border border-input bg-white px-2.5 text-[13.5px] outline-none transition focus:border-[var(--accent)]/50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13.5px] font-medium">Nuevo estado</span>
              <select
                value={correctDraft?.status ?? ""}
                onChange={(e) =>
                  correctDraft &&
                  setCorrectDraft({ ...correctDraft, status: e.target.value as CorrectDraft["status"] })
                }
                aria-label="Nuevo estado de la marcación"
                className="h-9 w-full rounded-md border border-input bg-white px-2.5 text-[13.5px] outline-none transition focus:border-[var(--accent)]/50"
              >
                <option value="">Mantener estado actual</option>
                <option value="APROBADA">Aprobar</option>
                <option value="RECHAZADA">Rechazar</option>
              </select>
            </label>
          </div>

          <div>
            <label htmlFor="corr-reason" className="text-[14px] font-medium">
              Motivo <span className="text-muted-foreground">(obligatorio)</span>
            </label>
            <Textarea
              id="corr-reason"
              value={correctDraft?.reason ?? ""}
              onChange={(e) => correctDraft && setCorrectDraft({ ...correctDraft, reason: e.target.value })}
              placeholder="Ej: Registro manual del jefe de terreno: ingresó 08:00, el teléfono marcó 08:47."
              className="mt-1.5 min-h-20 resize-none"
            />
            {correctDraft && correctDraft.reason.trim().length < 3 && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Escribe al menos 3 caracteres para dejar constancia.
              </p>
            )}
            {correctDraft && !(timeChanged || statusChanged) && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Cambia la hora y/o el estado para habilitar la confirmación.
              </p>
            )}
          </div>

          <p className="flex items-start gap-1.5 rounded-md bg-[#f1f4f1] px-2.5 py-2 text-[12.5px] leading-snug text-muted-foreground">
            <History className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            La marca original nunca se borra: el cambio queda en el historial de correcciones.
          </p>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setCorrectDraft(null)}
              className="h-9 rounded-md border border-input bg-white px-3 text-[13.5px] font-medium transition hover:bg-[#f4f6f4]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmCorrect}
              disabled={!canCorrect || correctBusy}
              className="h-9 rounded-md bg-primary px-3 text-[13.5px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {correctBusy ? "Guardando…" : "Confirmar corrección"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function confirmingLabel(d?: Decision) {
  if (d === "APROBADA") return "Confirmar aprobación";
  if (d === "RECHAZADA") return "Confirmar rechazo";
  return "Confirmar";
}
