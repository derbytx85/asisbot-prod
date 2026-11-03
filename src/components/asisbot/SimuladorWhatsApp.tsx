"use client";

// ─── Simulador WhatsApp (rol trabajador, demo) ──────────────────────────────
// Pantalla tipo chat: el trabajador escribe "entrada"/"salida", comparte
// ubicación y envía una selfie ilustrada. El sistema responde con el
// resultado simulado. Los 5 casos del brief §3.2 + los casos de las mejoras
// de mercado (§4 sin señal, §5 galería) se ejecutan con un clic.
// Mejoras integradas:
//   §1 Consentimiento informado obligatorio antes de la primera marca.
//   §1 Línea de privacidad siempre visible bajo la cabecera.
//   §4 Marca sin señal: queda en el teléfono (PENDIENTE_SYNC) y se sincroniza
//      después con su hora original.
//   §5 Foto de galería (siempre en revisión) y explicación del trabajador
//      adjunta a la marca en revisión.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCheck,
  ChevronLeft,
  Images,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { StatusPill } from "./StatusPill";
import { fmtHHMM } from "./format";
import {
  acceptConsent,
  addWorkerNote,
  getCheckins,
  getWorkers,
  getZones,
  markCheckin,
  resetDemo,
  syncCheckin,
  type MarkResult,
} from "./api";
import { PRIVACY_LINE, STATUS_LABEL } from "./types";
import type { Worker, Zone } from "./types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LocChoice = "dentro" | "fuera" | "sin" | "manual";
type SelfieKind = "referencia" | "otra" | "galeria";
type Step = "idle" | "location" | "selfie" | "explain" | "busy";
type Senal = "buena" | "sin";

interface ChatMsg {
  id: number;
  from: "bot" | "user";
  kind: "text" | "location" | "image" | "result" | "typing";
  text?: string;
  /** Píldora neutral opcional en mensajes de texto (p. ej. "Por sincronizar"). */
  pill?: string;
  loc?: { label: string; lat: number | null; lng: number | null };
  img?: string;
  /** Foto enviada desde la galería del teléfono (mejora §5). */
  gallery?: boolean;
  result?: {
    status: string;
    reason: string;
    similarity: number | null;
    type: "ENTRADA" | "SALIDA";
    hora: string;
  };
}

let msgId = 0;
const nid = () => ++msgId;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Versión del texto de consentimiento (debe coincidir con el backend). */
const CONSENT_VERSION_LABEL = "v1-2026-10";

// ─── Casos de demostración (brief §3.2 + mejoras de mercado) ─────────────────

interface DemoCase {
  id: number;
  title: string;
  desc: string;
  expected: string;
  worker: string;
  type: "ENTRADA" | "SALIDA";
  loc: LocChoice;
  selfie: SelfieKind;
  demoAt: string; // HH:MM simulado
  twice?: boolean;
  /** Caso sin señal: envía offline:true sin depender del toggle (mejora §4). */
  offline?: boolean;
}

const CASES: DemoCase[] = [
  {
    id: 1,
    title: "Marcación normal",
    desc: "Daniela marca entrada dentro de su zona, con su selfie (similitud alta).",
    expected: "Aprobada",
    worker: "Daniela Muñoz Vera",
    type: "ENTRADA",
    loc: "dentro",
    selfie: "referencia",
    demoAt: "08:05",
  },
  {
    id: 2,
    title: "Fuera de zona",
    desc: "La marcación de Daniela llega desde la otra obra, a km del radio autorizado.",
    expected: "En revisión · Fuera de zona",
    worker: "Daniela Muñoz Vera",
    type: "ENTRADA",
    loc: "fuera",
    selfie: "referencia",
    demoAt: "08:12",
  },
  {
    id: 3,
    title: "Posible suplantación",
    desc: "La selfie que envía Carlos no coincide con su foto de referencia (similitud baja).",
    expected: "En revisión · Suplantación",
    worker: "Carlos Medina Riquelme",
    type: "ENTRADA",
    loc: "dentro",
    selfie: "otra",
    demoAt: "08:18",
  },
  {
    id: 4,
    title: "Marcación duplicada",
    desc: "Pedro envía la misma entrada dos veces en menos de 5 minutos.",
    expected: "Rechazada · Duplicada",
    worker: "Pedro Rojas Muñoz",
    type: "ENTRADA",
    loc: "dentro",
    selfie: "referencia",
    demoAt: "07:40",
    twice: true,
  },
  {
    id: 5,
    title: "Entrada tardía",
    desc: "Luisa marca entrada después de su horario asignado (08:30 + tolerancia).",
    expected: "Aprobada · alerta de atraso",
    worker: "Luisa Herrera Pinto",
    type: "ENTRADA",
    loc: "dentro",
    selfie: "referencia",
    demoAt: "08:50",
  },
  {
    id: 6,
    title: "Foto de galería",
    desc: "Carlos envía una foto guardada en el teléfono, no tomada en el momento.",
    expected: "En revisión · Foto de galería",
    worker: "Carlos Medina Riquelme",
    type: "ENTRADA",
    loc: "dentro",
    selfie: "galeria",
    demoAt: "08:22",
  },
  {
    id: 7,
    title: "Marca sin señal",
    desc: "Daniela marca sin cobertura: queda en el teléfono y al sincronizar llega tarde con su hora original. Usa hora simulada; el caso la sincroniza al final.",
    expected: "Por sincronizar → Por revisar",
    worker: "Daniela Muñoz Vera",
    type: "ENTRADA",
    loc: "dentro",
    selfie: "referencia",
    demoAt: "08:14",
    offline: true,
  },
];

/** Píldora de resultado esperado según el texto del caso. */
function expectedPillOf(expected: string): string {
  if (expected.startsWith("Aprobada")) return "APROBADA";
  if (expected.startsWith("Rechazada")) return "RECHAZADA";
  if (expected.startsWith("Por sincronizar")) return "PENDIENTE_SYNC";
  return "EN_REVISION";
}

// ─── Búsqueda de punto según la zona del trabajador ─────────────────────────

function pointFor(
  worker: Worker,
  choice: LocChoice,
  zones: Zone[],
): { lat: number | null; lng: number | null; label: string } {
  if (choice === "sin" || !worker.zone) {
    return { lat: null, lng: null, label: choice === "sin" ? "Sin ubicación" : "—" };
  }
  const z = worker.zone;
  if (choice === "dentro") {
    return {
      lat: z.lat + 0.0007,
      lng: z.lng + 0.0006,
      label: `Ubicación en vivo · cerca de ${z.name}`,
    };
  }
  // "fuera": centro de la otra obra (o un punto a ~6 km si no hay otra)
  const other = zones.find((x) => x.id !== z.id);
  if (other) {
    return {
      lat: other.lat + 0.0004,
      lng: other.lng - 0.0005,
      label: `Ubicación en vivo · cerca de ${other.name}`,
    };
  }
  return {
    lat: z.lat - 0.054,
    lng: z.lng + 0.03,
    label: `Ubicación en vivo · lejos de ${z.name}`,
  };
}

/** Imagen ilustrada para cada tipo de selfie (la de galería es una foto guardada). */
function imgFor(selfie: SelfieKind): string {
  return selfie === "otra" ? "/demo/selfie-otro.png" : "/demo/selfie-carlos.png";
}

export function SimuladorWhatsApp() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: zonesData } = useQuery({ queryKey: ["zones"], queryFn: getZones });
  const zones = zonesData?.zones ?? [];
  const workers = useMemo(() => data?.workers.filter((w) => w.active) ?? [], [data]);

  const [workerId, setWorkerId] = useState<string | null>(null);
  const worker = workers.find((w) => w.id === workerId) ?? null;
  // Mejora §1: sin consentimiento aceptado no se puede marcar (el backend
  // también lo rechaza con 403 CONSENT_REQUIRED; la UI lo bloquea antes).
  const needsConsent = !!worker && !worker.consent;

  const [step, setStep] = useState<Step>("idle");
  const [pendingType, setPendingType] = useState<"ENTRADA" | "SALIDA" | null>(null);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [runningCase, setRunningCase] = useState<number | null>(null);

  // Mejora §4: señal del teléfono simulada
  const [senal, setSenal] = useState<Senal>("buena");
  const [syncing, setSyncing] = useState(false);

  // Marcas guardadas en el teléfono esperando cobertura (mejora §4)
  const { data: pendData } = useQuery({
    queryKey: ["checkins", "pendientes", workerId],
    queryFn: () => getCheckins({ workerId: workerId as string, status: "PENDIENTE_SYNC" }),
    enabled: !!workerId,
  });
  const pendientes = useMemo(() => pendData?.checkins ?? [], [pendData]);

  // Mejora §1: diálogo de consentimiento
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  // Mejora §5: explicación del trabajador (máx. 1 por marca)
  const [explainTarget, setExplainTarget] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const explainedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workerId && workers.length > 0) setWorkerId(workers[0].id);
  }, [workers, workerId]);

  useEffect(() => {
    setMsgs([
      {
        id: nid(),
        from: "bot",
        kind: "text",
        text: "Hola, soy AsisBot. Puedo registrar tu entrada o salida. Escribe “entrada” o “salida”, o usa los botones.",
      },
    ]);
  }, [workerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const push = (m: Omit<ChatMsg, "id">) => setMsgs((prev) => [...prev, { ...m, id: nid() }]);

  // ─── Mejora §5: explicación del trabajador ────────────────────────────────

  /** Tras un EN_REVISION ofrece explicar qué pasó (una sola vez por marca). */
  async function offerExplain(checkinId: string): Promise<boolean> {
    if (explainedRef.current.has(checkinId)) return false;
    await sleep(450);
    push({
      from: "bot",
      kind: "text",
      text: "¿Quieres explicar qué pasó? Tu comentario queda adjunto a la marca.",
    });
    setNoteInput("");
    setExplainTarget(checkinId);
    return true;
  }

  async function submitExplain(): Promise<void> {
    const text = noteInput.trim();
    const target = explainTarget;
    if (!target || explainBusy || text.length < 3) return;
    setExplainBusy(true);
    try {
      await addWorkerNote(target, text);
      explainedRef.current.add(target);
      push({ from: "user", kind: "text", text });
      await sleep(500);
      push({
        from: "bot",
        kind: "text",
        text: "Gracias: tu explicación quedó adjunta a la marca y el supervisor la verá al revisar.",
      });
      toast.success("Explicación enviada", { description: "Quedó adjunta a la marca en revisión." });
      setExplainTarget(null);
      setNoteInput("");
      setStep("idle");
      void qc.invalidateQueries();
    } catch (e) {
      toast.error("No se pudo enviar la explicación", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setExplainBusy(false);
    }
  }

  function skipExplain() {
    if (explainBusy) return;
    if (explainTarget) explainedRef.current.add(explainTarget);
    setExplainTarget(null);
    setNoteInput("");
    setStep("idle");
    push({
      from: "bot",
      kind: "text",
      text: "Sin problema. Siempre puedes avisar directamente a tu supervisor.",
    });
  }

  // ─── Respuesta del motor (normal, sin señal o en revisión) ────────────────

  async function handleMarkResponse(
    res: MarkResult,
    type: "ENTRADA" | "SALIDA",
  ): Promise<boolean> {
    await sleep(res.result.status === "PENDIENTE_SYNC" ? 900 : 1000);
    setMsgs((prev) => prev.filter((m) => m.kind !== "typing"));
    // Mejora §4: sin burbuja de resultado; el bot explica que quedó en el teléfono.
    if (res.result.status === "PENDIENTE_SYNC") {
      push({
        from: "bot",
        kind: "text",
        pill: "PENDIENTE_SYNC",
        text: `Sin señal: tu marca quedó guardada en el teléfono con su hora original (${fmtHHMM(res.checkin.timestamp)}). Se enviará sola cuando vuelva la cobertura.`,
      });
      return false;
    }
    push({
      from: "bot",
      kind: "result",
      result: {
        status: res.result.status,
        reason: res.result.reason,
        similarity: res.result.similarity,
        type,
        hora: fmtHHMM(res.checkin.timestamp),
      },
    });
    if (res.result.status === "EN_REVISION") {
      await sleep(400);
      push({
        from: "bot",
        kind: "text",
        text: "Tu marcación quedó EN REVISIÓN. Un supervisor la revisará y te informaremos.",
      });
      return offerExplain(res.checkin.id);
    }
    if (res.result.status === "RECHAZADA") {
      await sleep(450);
      push({
        from: "bot",
        kind: "text",
        text: "Tu marcación fue rechazada. Si crees que es un error, avisa a tu supervisor.",
      });
    }
    return false;
  }

  // ─── Flujo automatizado (casos demo) ──────────────────────────────────────

  async function sendMark(
    w: Worker,
    type: "ENTRADA" | "SALIDA",
    loc: LocChoice,
    selfie: SelfieKind,
    demoAt?: string,
    offline = false,
  ): Promise<{ id: string | null; explainOffered: boolean }> {
    const pt = pointFor(w, loc, zones);
    // Mejora §4: sin señal (toggle activo o caso forzado) la marca queda en el teléfono.
    const offlineNow = offline || senal === "sin";
    push({ from: "user", kind: "text", text: type.toLowerCase() });
    await sleep(420);
    push({
      from: "bot",
      kind: "text",
      text:
        type === "ENTRADA"
          ? "Registrando tu ENTRADA. Necesito tu ubicación y una selfie para verificar tu identidad."
          : "Registrando tu SALIDA. Necesito tu ubicación y una selfie para verificar tu identidad.",
    });
    await sleep(650);
    push({ from: "user", kind: "location", loc: { label: pt.label, lat: pt.lat, lng: pt.lng } });
    await sleep(550);
    push({ from: "user", kind: "image", img: imgFor(selfie), gallery: selfie === "galeria" });
    push({ from: "bot", kind: "typing", text: "" });
    setStep("busy");

    let explainOffered = false;
    try {
      const res = await markCheckin({
        workerId: w.id,
        type,
        lat: pt.lat,
        lng: pt.lng,
        selfieKind: selfie,
        demoAt: demoAt ? demoToIso(demoAt) : null,
        offline: offlineNow || undefined,
      });
      explainOffered = await handleMarkResponse(res, type);
      void qc.invalidateQueries();
      return { id: res.checkin.id, explainOffered };
    } catch (e) {
      setMsgs((prev) => prev.filter((m) => m.kind !== "typing"));
      push({ from: "bot", kind: "text", text: e instanceof Error ? e.message : "Error al registrar." });
      return { id: null, explainOffered: false };
    } finally {
      setStep(explainOffered ? "explain" : "idle");
      setPendingType(null);
    }
  }

  // ─── Flujo manual: entrada/salida → ubicación → selfie ────────────────────

  function startManual(type: "ENTRADA" | "SALIDA") {
    if (!worker || step !== "idle") return;
    // Mejora §1: recordatorio si falta el consentimiento (los botones ya están bloqueados)
    if (!worker.consent) {
      push({ from: "user", kind: "text", text: type.toLowerCase() });
      push({
        from: "bot",
        kind: "text",
        text: "Sin aceptar el consentimiento no puedes marcar. Usa el botón “Ver y aceptar consentimiento”.",
      });
      return;
    }
    setPendingType(type);
    setStep("location");
    push({ from: "user", kind: "text", text: type.toLowerCase() });
    push({
      from: "bot",
      kind: "text",
      text: "Comparte tu ubicación para validar que estás dentro de tu zona de trabajo.",
    });
  }

  function chooseLocation(choice: LocChoice) {
    if (!worker || step !== "location") return;
    setStep("selfie");
    const pt = pointFor(worker, choice, zones);
    push({ from: "user", kind: "location", loc: { label: pt.label, lat: pt.lat, lng: pt.lng } });
    push({ from: "bot", kind: "text", text: "Gracias. Ahora envíame una selfie para verificar tu identidad." });
  }

  async function chooseSelfie(selfie: SelfieKind) {
    if (!worker || !pendingType || step !== "selfie") return;
    const type = pendingType;
    push({ from: "user", kind: "image", img: imgFor(selfie), gallery: selfie === "galeria" });
    push({ from: "bot", kind: "typing", text: "" });
    setStep("busy");
    const loc = lastLocOf(msgs);
    let explainOffered = false;
    try {
      const res = await markCheckin({
        workerId: worker.id,
        type,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        selfieKind: selfie,
        demoAt: null,
        // Mejora §4: con el toggle en "Sin señal" la marca queda en el teléfono
        offline: senal === "sin" || undefined,
      });
      explainOffered = await handleMarkResponse(res, type);
      void qc.invalidateQueries();
    } catch (e) {
      setMsgs((prev) => prev.filter((m) => m.kind !== "typing"));
      push({ from: "bot", kind: "text", text: e instanceof Error ? e.message : "Error al registrar." });
    } finally {
      setStep(explainOffered ? "explain" : "idle");
      setPendingType(null);
    }
  }

  function lastLocOf(msgs: ChatMsg[]) {
    const loc = [...msgs].reverse().find((m) => m.kind === "location");
    return loc?.loc ?? null;
  }

  // ─── Mejora §4: sincronización de marcas guardadas en el teléfono ─────────

  /** Sincroniza una marca pendiente y confirma en el chat con ambas horas. */
  async function syncOne(id: string): Promise<void> {
    const res = await syncCheckin(id);
    const horaOrig = fmtHHMM(res.checkin.timestamp);
    const horaSync = fmtHHMM(res.checkin.syncAt ?? new Date().toISOString());
    const mins = res.result.syncLateMin ?? 0;
    const minsTxt = mins > 0 ? `${mins} min` : "menos de 1 min";
    let text = `Sincronizada: tu marca de las ${horaOrig} llegó al sistema a las ${horaSync} (${minsTxt} después, sin señal).`;
    if (res.result.status === "EN_REVISION") {
      text += " Quedó por revisar: un supervisor la confirmará.";
    }
    push({ from: "bot", kind: "text", text });
  }

  async function handleSyncAll() {
    if (!worker || step !== "idle" || syncing || pendientes.length === 0) return;
    setSyncing(true);
    try {
      for (const c of [...pendientes]) {
        await sleep(400);
        await syncOne(c.id);
      }
      toast.success("Marcas sincronizadas", {
        description: "Llegaron al sistema con su hora original; revisa el panel y la cola de revisión.",
      });
      void qc.invalidateQueries();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al sincronizar.";
      push({ from: "bot", kind: "text", text: msg });
      toast.error("No se pudo sincronizar", { description: msg });
      void qc.invalidateQueries();
    } finally {
      setSyncing(false);
    }
  }

  // ─── Mejora §1: consentimiento ────────────────────────────────────────────

  function declineConsent() {
    setConsentOpen(false);
    push({
      from: "bot",
      kind: "text",
      text: "Sin aceptar el consentimiento no puedes marcar entrada ni salida. Puedes revisarlo y aceptarlo cuando quieras.",
    });
  }

  async function handleAcceptConsent() {
    if (!worker || consentBusy) return;
    setConsentBusy(true);
    try {
      const res = await acceptConsent(worker.id);
      await qc.invalidateQueries({ queryKey: ["workers"] });
      setConsentOpen(false);
      const fecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "long" }).format(
        new Date(res.consent.acceptedAt),
      );
      push({
        from: "bot",
        kind: "text",
        text: `Listo: aceptaste el consentimiento (versión ${res.consent.version}) el ${fecha}. Ya puedes marcar tu entrada o salida.`,
      });
      toast.success("Consentimiento aceptado", {
        description: `Versión ${res.consent.version}, registrada con fecha.`,
      });
    } catch (e) {
      toast.error("No se pudo aceptar el consentimiento", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setConsentBusy(false);
    }
  }

  // ─── Ejecución de casos demo ──────────────────────────────────────────────

  async function runCase(c: DemoCase) {
    if (step !== "idle") return;
    const w = workers.find((x) => x.name === c.worker);
    if (!w) return;
    // Mejora §1: los casos respetan el consentimiento del trabajador
    if (!w.consent) {
      toast.error("Sin consentimiento no se puede marcar", {
        description: `Selecciona a ${w.name.split(" ").slice(0, 2).join(" ")} y acepta el consentimiento en el chat.`,
      });
      return;
    }
    setRunningCase(c.id);
    setWorkerId(w.id);
    await sleep(350);
    const first = await sendMark(w, c.type, c.loc, c.selfie, c.demoAt, c.offline === true);
    if (c.twice) {
      await sleep(900);
      await sendMark(w, c.type, c.loc, c.selfie, addMinutes(c.demoAt, 1), c.offline === true);
    }
    // Caso sin señal: el propio caso sincroniza su marca (independiente del toggle)
    if (c.offline && first.id) {
      await sleep(900);
      try {
        await syncOne(first.id);
        void qc.invalidateQueries();
      } catch (e) {
        push({ from: "bot", kind: "text", text: e instanceof Error ? e.message : "Error al sincronizar." });
      }
    }
    setRunningCase(null);
    toast.success(`Caso ${c.id} ejecutado`, {
      description: first.explainOffered
        ? `${c.title} — el bot preguntó si quieres explicar qué pasó; respóndele u omite en el chat.`
        : `${c.title} — revisa el panel y la cola de revisión.`,
    });
  }

  async function handleReset() {
    await resetDemo();
    setMsgs([]);
    void qc.invalidateQueries();
    toast.success("Demo reiniciada", { description: "Datos semilla restaurados (ficticios)." });
  }

  function onSend() {
    const t = input.trim().toLowerCase();
    if (!t) return;
    setInput("");
    if (t.includes("entrada")) startManual("ENTRADA");
    else if (t.includes("salida")) startManual("SALIDA");
    else {
      push({ from: "user", kind: "text", text: t });
      push({
        from: "bot",
        kind: "text",
        text: "Solo puedo registrar entrada o salida. Escribe “entrada” o “salida”.",
      });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
      {/* Columna izquierda: teléfono con WhatsApp */}
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-white" data-ui>
        {/* cabecera tipo WhatsApp */}
        <div className="flex items-center gap-2.5 bg-[#075e54] px-3 py-2.5 text-white">
          <ChevronLeft className="size-4 opacity-90" aria-hidden />
          {worker && <Avatar name={worker.name} hue={worker.avatarHue} size={30} />}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] font-medium">{worker?.name ?? "…"}</p>
            <p className="text-[11px] text-white/75">en línea · {worker?.phone}</p>
          </div>
          {/* Mejora §4: simulación de la señal del teléfono */}
          <button
            type="button"
            onClick={() => setSenal((s) => (s === "buena" ? "sin" : "buena"))}
            disabled={step === "busy"}
            aria-pressed={senal === "sin"}
            title="Simular la señal del teléfono"
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition active:scale-[0.98] disabled:opacity-50 ${
              senal === "buena"
                ? "bg-white/15 text-white hover:bg-white/25"
                : "bg-[#fde68a] text-[#7c5a06] hover:bg-[#fcd34d]"
            }`}
          >
            {senal === "buena" ? (
              <Wifi className="size-3.5" aria-hidden />
            ) : (
              <WifiOff className="size-3.5" aria-hidden />
            )}
            {senal === "buena" ? "Buena" : "Sin señal"}
          </button>
          <Video className="size-4 opacity-90" aria-hidden />
          <Phone className="size-4 opacity-90" aria-hidden />
        </div>

        {/* Mejora §1: línea de privacidad siempre visible */}
        <p className="flex items-start gap-1.5 border-b border-black/10 bg-[#fdf4c8] px-3 py-1.5 text-[11px] leading-snug text-[#5c5040]">
          <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden />
          {PRIVACY_LINE}
        </p>

        {/* chat */}
        <div ref={scrollRef} className="wa-chat-bg scroll-fine h-[480px] space-y-2 overflow-y-auto px-3 py-3 lg:h-[540px]">
          <p className="mx-auto w-fit rounded-md bg-[#fdf4c8] px-2.5 py-1 text-center text-[11px] leading-snug text-[#5c5040]">
            DEMO — datos ficticios. Las selfies son ilustraciones.
          </p>
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.kind === "typing" ? (
                  <div className="flex items-center gap-1 rounded-lg rounded-bl-sm bg-white px-3 py-2.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="size-1.5 wa-typing-dot rounded-full bg-[#8696a0]"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                ) : m.kind === "result" && m.result ? (
                  <div className="max-w-[85%] rounded-lg bg-white px-3 py-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <StatusPill status={m.result.status} />
                      <span className="num text-[11px] text-[#667781]">{m.result.hora}</span>
                    </div>
                    {m.result.similarity !== null && (
                      <p className="text-[12px] text-[#667781]">
                        Verificación de identidad: <strong className="text-[#111b21]">{m.result.similarity}%</strong>
                      </p>
                    )}
                    <p className="text-[13px] leading-snug text-[#111b21]">{m.result.reason}</p>
                    <p className="mt-1 text-right text-[10px] text-[#8696a0]">
                      {fmtHHMM(new Date().toISOString())} <CheckCheck className="inline size-3" />
                    </p>
                  </div>
                ) : m.kind === "location" && m.loc ? (
                  <div className="max-w-[75%] overflow-hidden rounded-lg bg-[#d9fdd3]">
                    <div className="flex h-24 items-end bg-[#cfe0cf] [background-image:radial-gradient(#b9cdb9_1.2px,transparent_1.2px)] [background-size:14px_14px] /* taste-skill-ignore: mini-mapa del fragmento WhatsApp (data-ui) */ px-2 pb-1.5">
                      <span className="flex items-center gap-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-[#111b21]">
                        <MapPin className="size-3 text-[#0e7a47]" /> {m.loc.lat !== null ? `${m.loc.lat.toFixed(4)}, ${m.loc.lng?.toFixed(4)}` : "no compartida"}
                      </span>
                    </div>
                    <p className="px-2.5 py-1.5 text-[12px] text-[#111b21]">{m.loc.label}</p>
                  </div>
                ) : m.kind === "image" && m.img ? (
                  <div className="relative max-w-[62%]">
                    <img
                      src={m.img}
                      alt={m.gallery ? "Foto de galería enviada (ilustración de demostración)" : "Selfie enviada (ilustración de demostración)"}
                      className="w-full rounded-lg"
                    />
                    {/* Mejora §5: distingue una foto guardada de una tomada ahora */}
                    {m.gallery && (
                      <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        <Images className="size-3" aria-hidden />
                        desde galería
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-[13.5px] leading-snug ${
                      m.from === "user"
                        ? "rounded-br-sm bg-[#d9fdd3] text-[#111b21]"
                        : "rounded-bl-sm bg-white text-[#111b21]"
                    }`}
                  >
                    {m.pill && (
                      <span className="pill pill-neutral mb-1.5">{STATUS_LABEL[m.pill] ?? m.pill}</span>
                    )}
                    <p className="whitespace-pre-wrap">
                      {m.text}
                      <span className="ml-2 inline-block align-bottom text-[10px] text-[#8696a0]">
                        {fmtHHMM(new Date().toISOString())}
                      </span>
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Mejora §1: presentación del consentimiento cuando falta (burbuja fija del bot) */}
          {needsConsent && (
            <motion.div
              key="consent-cta"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="flex justify-start"
            >
              <div className="max-w-[85%] rounded-lg rounded-bl-sm bg-white px-3 py-2.5">
                <p className="text-[13.5px] leading-snug text-[#111b21]">
                  Antes de tu primera marca necesito tu permiso para registrar tu asistencia.
                </p>
                <button
                  type="button"
                  onClick={() => setConsentOpen(true)}
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0e7a47] px-3 text-[12.5px] font-medium text-white transition hover:bg-[#0c6a3e] active:scale-[0.98]"
                >
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Ver y aceptar consentimiento
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* respuestas rápidas + input */}
        <div className="border-t border-black/5 bg-[#f0f2f0] px-2.5 py-2">
          {/* Mejora §4: marcas guardadas esperando cobertura (solo con señal buena) */}
          {worker && senal === "buena" && pendientes.length > 0 && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={step === "busy" || syncing}
              className="mb-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-[#e8d48b] bg-[#fdf4c8] px-3 text-[12.5px] font-medium text-[#7c5a06] transition hover:bg-[#fbeeb5] active:scale-[0.99] disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden />
              Sincronizar {pendientes.length} {pendientes.length === 1 ? "marca" : "marcas"}
            </button>
          )}
          <div className="mb-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => startManual("ENTRADA")}
              disabled={step !== "idle" || !worker || needsConsent}
              className="rounded-full border border-[#cfcfcf] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#111b21] transition hover:bg-[#f6f6f6] disabled:opacity-40"
            >
              Marcar entrada
            </button>
            <button
              type="button"
              onClick={() => startManual("SALIDA")}
              disabled={step !== "idle" || !worker || needsConsent}
              className="rounded-full border border-[#cfcfcf] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#111b21] transition hover:bg-[#f6f6f6] disabled:opacity-40"
            >
              Marcar salida
            </button>
          </div>
          {step === "location" && (
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Opciones de ubicación">
              <Chip onClick={() => chooseLocation("dentro")} label="Dentro de la zona" />
              <Chip onClick={() => chooseLocation("fuera")} label="Fuera de la zona" />
              <Chip onClick={() => chooseLocation("sin")} label="Sin ubicación" />
            </div>
          )}
          {step === "selfie" && (
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Opciones de selfie">
              <button
                type="button"
                onClick={() => chooseSelfie("referencia")}
                className="flex items-center gap-1.5 rounded-full border border-[#cfcfcf] bg-white py-1 pl-1 pr-3 text-[12.5px] font-medium text-[#111b21] transition hover:bg-[#f6f6f6]"
              >
                <img src="/demo/selfie-carlos.png" alt="" className="size-6 rounded-full object-cover" />
                Selfie (yo)
              </button>
              <button
                type="button"
                onClick={() => chooseSelfie("otra")}
                className="flex items-center gap-1.5 rounded-full border border-[#cfcfcf] bg-white py-1 pl-1 pr-3 text-[12.5px] font-medium text-[#111b21] transition hover:bg-[#f6f6f6]"
              >
                <img src="/demo/selfie-otro.png" alt="" className="size-6 rounded-full object-cover" />
                Selfie (otra persona)
              </button>
              {/* Mejora §5: foto guardada en el teléfono, no tomada en el momento */}
              <button
                type="button"
                onClick={() => chooseSelfie("galeria")}
                className="flex items-center gap-1.5 rounded-full border border-[#cfcfcf] bg-white py-1 pl-1 pr-3 text-[12.5px] font-medium text-[#111b21] transition hover:bg-[#f6f6f6]"
              >
                <span className="relative">
                  <img src="/demo/selfie-carlos.png" alt="" className="size-6 rounded-full object-cover" />
                  <span className="absolute -bottom-1 -right-1 rounded-sm bg-[#b45309] px-1 text-[8px] font-semibold uppercase leading-3 text-white">
                    Galería
                  </span>
                </span>
                Foto de galería
              </button>
            </div>
          )}
          {/* Mejora §5: explicación del trabajador para una marca en revisión */}
          {step === "explain" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitExplain();
              }}
              className="mb-2 flex items-center gap-1.5"
              aria-label="Explicación para el supervisor"
            >
              <input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Explica qué pasó (mínimo 3 caracteres)"
                aria-label="Tu explicación"
                maxLength={280}
                disabled={explainBusy}
                className="h-9 min-w-0 flex-1 rounded-full border border-transparent bg-white px-3.5 text-[13.5px] outline-none transition placeholder:text-[#8696a0] focus:border-[#0e7a47]/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={explainBusy || noteInput.trim().length < 3}
                className="inline-flex h-9 shrink-0 items-center rounded-full bg-[#0e7a47] px-3 text-[12.5px] font-medium text-white transition hover:bg-[#0c6a3e] active:scale-95 disabled:opacity-40"
              >
                Enviar explicación
              </button>
              <button
                type="button"
                onClick={skipExplain}
                disabled={explainBusy}
                className="h-9 shrink-0 rounded-full border border-[#cfcfcf] bg-white px-3 text-[12.5px] font-medium text-[#111b21] transition hover:bg-[#f6f6f6] disabled:opacity-40"
              >
                Omitir
              </button>
            </form>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe un mensaje"
              aria-label="Escribe un mensaje"
              className="h-9 flex-1 rounded-full border border-transparent bg-white px-3.5 text-[13.5px] outline-none transition placeholder:text-[#8696a0] focus:border-[#0e7a47]/40"
            />
            <button
              type="submit"
              aria-label="Enviar"
              className="grid size-9 place-items-center rounded-full bg-[#0e7a47] text-white transition hover:bg-[#0c6a3e] active:scale-95"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Columna derecha: controles de la demo */}
      <div className="flex flex-col gap-4">
        <section aria-labelledby="sim-worker-h" className="rounded-lg border border-border bg-card p-4">
          <h2 id="sim-worker-h" className="text-[16px] font-semibold">
            Trabajador de la demo
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Cada persona marca desde su propio WhatsApp simulado.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {workers.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  if (step !== "idle") return;
                  setWorkerId(w.id);
                }}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[12.5px] font-medium transition ${
                  w.id === workerId
                    ? "border-[#0e7a47]/50 bg-[#eaf5ef] text-[#0b5c37]"
                    : "border-border bg-white text-foreground hover:bg-[#f4f6f4]"
                } disabled:opacity-50`}
                disabled={step !== "idle"}
              >
                <Avatar name={w.name} hue={w.avatarHue} size={24} />
                {w.name.split(" ").slice(0, 2).join(" ")}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="sim-cases-h" className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="sim-cases-h" className="text-[16px] font-semibold">
                Casos de demostración
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Los 5 casos del brief + los de las mejoras de mercado, con hora simulada para que
                sean reproducibles a cualquier hora.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="h-8 rounded-md border border-input bg-white px-3 text-[13px] font-medium transition hover:bg-[#f4f6f4]"
            >
              Reiniciar demo
            </button>
          </div>
          <ul className="scroll-fine mt-3 max-h-96 divide-y divide-[#eef0ee] overflow-y-auto">
            {CASES.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm bg-[#eef1ee] text-[12px] font-semibold text-[#383f38]">
                  {c.id}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{c.title}</p>
                  <p className="text-[12.5px] leading-snug text-muted-foreground">{c.desc}</p>
                  <p className="mt-1 text-[12px] text-[#667781]">
                    {c.worker.split(" ").slice(0, 2).join(" ")} · {c.type.toLowerCase()} {c.demoAt} (hora simulada)
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusPill status={expectedPillOf(c.expected)} />
                  <button
                    type="button"
                    onClick={() => runCase(c)}
                    disabled={step !== "idle" || runningCase !== null}
                    className="h-8 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                  >
                    {runningCase === c.id ? "Ejecutando…" : "Ejecutar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-[12px] leading-relaxed text-muted-foreground">
          El prototipo simula la verificación facial (puntaje ficticio) y la geocerca. En producción,
          la integración real usa WhatsApp Cloud API, geolocalización del teléfono y un motor
          biométrico; la decisión ante una inconsistencia siempre la revisa una persona autorizada.
        </p>
      </div>

      {/* Mejora §1: consentimiento informado (lenguaje simple) */}
      <Dialog
        open={consentOpen}
        onOpenChange={(o) => {
          if (!o && !consentBusy) declineConsent();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[16px]">
              <ShieldCheck className="size-4 shrink-0 text-[#0e7a47]" aria-hidden />
              Consentimiento para registrar tu asistencia
            </DialogTitle>
            <DialogDescription>
              Te lo explicamos en lenguaje simple. Puedes aceptar o seguir sin aceptar.
            </DialogDescription>
          </DialogHeader>
          <div className="scroll-fine max-h-[46vh] space-y-2.5 overflow-y-auto pr-1">
            <ConsentItem
              q="¿Qué se registra?"
              a="Una foto selfie, tu ubicación y la hora. Solo en el momento en que marcas entrada o salida."
            />
            <ConsentItem
              q="¿Para qué?"
              a="Para validar esa marcación: confirmar que fuiste tú y que estabas en tu lugar de trabajo."
            />
            <ConsentItem q="¿Quién lo ve?" a="Tu supervisor directo y RR.HH. Nadie más." />
            <ConsentItem
              q="¿Por cuánto tiempo?"
              a="Por el tiempo que defina la empresa. Puedes pedir su eliminación cuando quieras desde “Mis marcas”."
            />
            <p className="rounded-md bg-[#fdf4c8] px-2.5 py-2 text-[12px] leading-snug text-[#5c5040]">
              Fuera de tu jornada no hay registro: la app no guarda ubicación ni fotos fuera de tu
              horario.
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">Versión del texto: {CONSENT_VERSION_LABEL}</p>
          <DialogFooter>
            <button
              type="button"
              onClick={declineConsent}
              disabled={consentBusy}
              className="h-9 rounded-md border border-input bg-white px-3.5 text-[13px] font-medium transition hover:bg-[#f4f6f4] disabled:opacity-50"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={handleAcceptConsent}
              disabled={consentBusy}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              {consentBusy ? "Guardando…" : "Aceptar y continuar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Pregunta y respuesta en lenguaje simple dentro del consentimiento. */
function ConsentItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-[#111b21]">{q}</p>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{a}</p>
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-[#cfcfcf] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#111b21] transition hover:bg-[#f6f6f6]"
    >
      <MapPin className="size-3.5 text-[#0e7a47]" />
      {label}
    </button>
  );
}

/** "08:05" → ISO de hoy Chile a esa hora */
function demoToIso(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  const asUTC = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), h, m);
  // offset Chile del momento
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p2 = dtf.formatToParts(new Date());
  const g = (t: string) => Number(p2.find((x) => x.type === t)?.value ?? 0);
  const off = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - Date.now();
  return new Date(asUTC - off).toISOString();
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + min;
  const p = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${p((total / 60) % 24)}:${p(total % 60)}`;
}
