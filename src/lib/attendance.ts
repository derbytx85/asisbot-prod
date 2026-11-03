// ─── AsisBot · Motor de verificación simulado ───────────────────────────────
// Reglas de negocio del prototipo (demo). La IA solo SUGIERE: toda decisión
// final es humana y queda auditada (brief §5).
//
// Casos que la demo DEBE cubrir (brief §3.2 + mejoras de mercado):
//   1. Dentro de zona + selfie similar            → APROBADA
//   2. Fuera de zona autorizada                   → EN_REVISION + FUERA_ZONA
//   3. Selfie con baja similitud simulada         → EN_REVISION + SUPLANTACION
//   4. Marcación duplicada en pocos minutos       → RECHAZADA + DUPLICADA
//   5. Entrada tardía respecto al horario         → APROBADA + ATRASO (alerta)
//   6. Foto de galería (no tomada en el momento)  → EN_REVISION + FOTO_GALERIA
//   7. Ubicación incoherente con la marca anterior→ EN_REVISION + INCOHERENTE
//   8. Sincronización tardía (sin señal)          → EN_REVISION + SYNC_TARDE
//   (la sincronización tardía se evalúa en POST /api/checkins/[id]/sync)

import { chileParts } from "./tz";

export type CheckType = "ENTRADA" | "SALIDA";
export type CheckStatus = "APROBADA" | "EN_REVISION" | "RECHAZADA" | "PENDIENTE_SYNC";
export type AlertType =
  | "FUERA_ZONA"
  | "SUPLANTACION"
  | "DUPLICADA"
  | "ATRASO"
  | "SIN_UBICACION"
  | "SIN_ENTRADA"
  | "SIN_SELFIE"
  | "FOTO_GALERIA"
  | "INCOHERENTE"
  | "SYNC_TARDE";
export type SelfieKind = "referencia" | "otra" | "galeria";

export const REVIEWER = "M. Contreras · RR.HH.";
export const LATE_TOLERANCE_MIN = 10;
export const DUPLICATE_WINDOW_MIN = 5;
export const SIMILARITY_THRESHOLD = 75;
// Umbral para alertar sincronización tardía (marca hecha sin señal)
export const SYNC_LATE_THRESHOLD_MIN = 30;
// Umbral de salto imposible entre marcas consecutivas (coherencia)
export const COHERENCE_DISTANCE_M = 2000;
export const COHERENCE_WINDOW_MIN = 90;
export const CONSENT_VERSION = "v1-2026-10";

// ─── Utilidades ─────────────────────────────────────────────────────────────

/** Distancia haversine en metros entre dos coordenadas. */
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** 840 → "840 m" · 8400 → "8,4 km" (formato es-CL). */
export function formatDistance(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

export function formatHHMM(d: Date): string {
  const p = chileParts(d); // hora de pared Chile, independiente del TZ del servidor
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Clave de día chileno "YYYY-MM-DD" para agrupar por jornada. */
export function chileDayKey(d: Date): string {
  const p = chileParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** 504 min → "8 h 24 min" */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** "08:30" → minutos desde medianoche. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesOfDay(d: Date): number {
  const p = chileParts(d);
  return p.hour * 60 + p.minute;
}

/** Hash estable pequeño para jitter determinista (mismo minuto → mismo puntaje). */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// ─── Simulación de verificación facial ──────────────────────────────────────
// En producción esto lo hace un motor biométrico real. En el prototipo el
// puntaje es SIMULADO: depende de la selfie elegida, con variación estable.

export function simulateSimilarity(
  workerId: string,
  selfieKind: SelfieKind | null,
  at: Date,
): number | null {
  if (!selfieKind) return null;
  const bucket = Math.floor(at.getTime() / 60000); // estable por minuto
  const h = hashStr(`${workerId}:${selfieKind}:${bucket}`);
  if (selfieKind === "otra") return 52 + (h % 20); // 52–71 %
  // "referencia" y "galeria": una foto de galería PUEDE ser el propio
  // trabajador (foto vieja), por eso la similitud se comporta igual; lo que
  // la delata no es el rostro sino que no fue tomada en el momento.
  return 88 + (h % 10); // 88–97 %
}

// ─── Evaluación de una marcación ────────────────────────────────────────────

export interface EvaluateInput {
  workerId: string;
  type: CheckType;
  now: Date;
  lat: number | null;
  lng: number | null;
  selfieKind: SelfieKind | null;
  zone: { name: string; lat: number; lng: number; radiusM: number } | null;
  scheduleStart: string;
  lastSameTypeToday: { timestamp: Date } | null;
  firstEntradaToday: { timestamp: Date } | null;
  /** Última marca anterior del día con posición (cualquier tipo): coherencia. */
  prevMarkToday: { timestamp: Date; lat: number | null; lng: number | null } | null;
}

export interface AlertDraft {
  type: AlertType;
  message: string;
}

export interface EvaluateResult {
  status: CheckStatus;
  reason: string;
  alerts: AlertDraft[];
  distanceM: number | null;
  similarity: number | null;
  /** Minutos entre la hora original y la sincronización (marca sin señal). */
  syncLateMin?: number | null;
}

export function evaluateCheckIn(input: EvaluateInput): EvaluateResult {
  const {
    workerId,
    type,
    now,
    lat,
    lng,
    selfieKind,
    zone,
    scheduleStart,
    lastSameTypeToday,
    firstEntradaToday,
    prevMarkToday,
  } = input;

  const hhmm = formatHHMM(now);
  const alerts: AlertDraft[] = [];
  const parts: string[] = [];
  let blocking = false;
  const hasNewPos = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);

  // 1. Duplicada: misma marcación ya registrada hace menos de 5 minutos.
  if (lastSameTypeToday) {
    const diffMin = Math.round(
      (now.getTime() - lastSameTypeToday.timestamp.getTime()) / 60000,
    );
    if (diffMin < DUPLICATE_WINDOW_MIN) {
      alerts.push({
        type: "DUPLICADA",
        message: `Marcación duplicada: ya se registró ${type.toLowerCase()} a las ${formatHHMM(lastSameTypeToday.timestamp)} (hace ${diffMin} min).`,
      });
      return {
        status: "RECHAZADA",
        reason: `Marcación duplicada: ya existía una ${type.toLowerCase()} registrada hace ${diffMin} min. No se tomó una nueva marcación.`,
        alerts,
        distanceM: null,
        similarity: null,
      };
    }
  }

  // 2. Verificación de identidad simulada (selfie vs foto de referencia).
  const similarity = simulateSimilarity(workerId, selfieKind, now);
  if (selfieKind === null || similarity === null) {
    blocking = true;
    alerts.push({
      type: "SIN_SELFIE",
      message: "La marcación llegó sin selfie: no se pudo verificar la identidad.",
    });
    parts.push("sin selfie de verificación");
  } else if (selfieKind === "galeria") {
    // Mejora §5: foto en el momento, no de galería. Una imagen de galería
    // puede ser una foto vieja: la identidad puede coincidir, pero la marca
    // SIEMPRE pasa a revisión (la IA alerta, no sanciona).
    blocking = true;
    alerts.push({
      type: "FOTO_GALERIA",
      message: `La foto no fue tomada en el momento (desde galería). Similitud ${similarity}% con la referencia, pero un supervisor debe confirmar la marca.`,
    });
    parts.push("foto enviada desde la galería (no tomada en el momento)");
  } else if (similarity < SIMILARITY_THRESHOLD) {
    blocking = true;
    alerts.push({
      type: "SUPLANTACION",
      message: `Posible suplantación: la selfie tiene ${similarity}% de similitud con la foto de referencia (umbral ${SIMILARITY_THRESHOLD}%).`,
    });
    parts.push(`selfie con ${similarity}% de similitud (posible suplantación)`);
  } else {
    parts.push(`identidad verificada (${similarity}%)`);
  }

  // 3. Ubicación y geocerca.
  let distanceM: number | null = null;
  if (lat === null || lng === null) {
    blocking = true;
    alerts.push({
      type: "SIN_UBICACION",
      message: "La marcación llegó sin ubicación compartida.",
    });
    parts.push("sin ubicación compartida");
  } else if (zone) {
    distanceM = haversineM(lat, lng, zone.lat, zone.lng);
    if (distanceM > zone.radiusM) {
      blocking = true;
      alerts.push({
        type: "FUERA_ZONA",
        message: `Marcación a ${formatDistance(distanceM)} de ${zone.name} (radio autorizado: ${zone.radiusM} m).`,
      });
      parts.push(
        `a ${formatDistance(distanceM)} de ${zone.name}, fuera del radio de ${zone.radiusM} m`,
      );
    } else {
      parts.push(`dentro de ${zone.name} (a ${formatDistance(distanceM)})`);
    }
  }

  // 4. Atraso (solo ENTRADA): no bloquea, se aprueba con alerta.
  if (type === "ENTRADA") {
    const lateMin = minutesOfDay(now) - hhmmToMinutes(scheduleStart);
    if (lateMin > LATE_TOLERANCE_MIN) {
      alerts.push({
        type: "ATRASO",
        message: `Entrada a las ${hhmm}; horario asignado ${scheduleStart} (${formatMinutes(lateMin)} de atraso).`,
      });
      parts.push(`atraso de ${formatMinutes(lateMin)}`);
    }
  }

  // 5. Salida sin entrada hoy.
  if (type === "SALIDA" && !firstEntradaToday) {
    blocking = true;
    alerts.push({
      type: "SIN_ENTRADA",
      message: "Salida registrada sin una entrada previa hoy.",
    });
    parts.push("salida sin entrada registrada hoy");
  }

  // 6. Coherencia con la marca anterior del día (mejora §5): un salto
  // imposible entre dos marcas consecutivas sugiere ubicación falsa o
  // error; nunca sanciona, solo pasa a revisión.
  if (prevMarkToday && prevMarkToday.lat !== null && prevMarkToday.lng !== null && hasNewPos) {
    const gapMin = Math.round((now.getTime() - prevMarkToday.timestamp.getTime()) / 60000);
    if (gapMin > 0 && gapMin < COHERENCE_WINDOW_MIN) {
      const jump = haversineM(lat!, lng!, prevMarkToday.lat, prevMarkToday.lng);
      if (jump > COHERENCE_DISTANCE_M) {
        blocking = true;
        alerts.push({
          type: "INCOHERENTE",
          message: `Ubicación incoherente: a ${formatDistance(jump)} de la marca anterior de ${formatHHMM(prevMarkToday.timestamp)} (hace ${gapMin} min).`,
        });
        parts.push(
          `a ${formatDistance(jump)} de la marca anterior (${formatHHMM(prevMarkToday.timestamp)})`,
        );
      }
    }
  }

  const status: CheckStatus = blocking ? "EN_REVISION" : "APROBADA";

  let reason: string;
  if (status === "APROBADA" && type === "SALIDA" && firstEntradaToday) {
    const worked = Math.max(
      0,
      Math.round((now.getTime() - firstEntradaToday.timestamp.getTime()) / 60000),
    );
    reason = `Jornada de ${formatMinutes(worked)} (entrada ${formatHHMM(firstEntradaToday.timestamp)} — salida ${hhmm}). ${parts.join(" · ")}.`;
  } else if (status === "APROBADA") {
    reason = `Marcación correcta: ${parts.join(" · ")}.`;
  } else {
    reason = `En revisión: ${parts.join(" · ")}. Un supervisor debe revisar esta marcación.`;
  }

  return { status, reason, alerts, distanceM, similarity };
}

/**
 * Marca sincronizada tarde (mejora §4): se evalúa con su hora ORIGINAL y si
 * llegó tarde queda EN_REVISION con ambas horas visibles. Nunca se reescribe
 * la hora original.
 */
export function evaluateSyncLate(
  base: EvaluateResult,
  originalAt: Date,
  syncedAt: Date,
): EvaluateResult {
  const lateMin = Math.max(0, Math.round((syncedAt.getTime() - originalAt.getTime()) / 60000));
  if (lateMin <= SYNC_LATE_THRESHOLD_MIN) return { ...base, syncLateMin: lateMin };

  const msg = `Sincronización tardía: la marca es de las ${formatHHMM(originalAt)} pero llegó al sistema ${formatMinutes(lateMin)} después (sin señal).`;
  const alerts: AlertDraft[] = [
    ...base.alerts,
    { type: "SYNC_TARDE", message: msg },
  ];
  const reason =
    base.status === "APROBADA"
      ? `Por revisar: ${base.reason} La marca se hizo a las ${formatHHMM(originalAt)} pero se sincronizó ${formatMinutes(lateMin)} después (sin señal). Un supervisor debe confirmarla.`
      : `${base.reason} Además, se sincronizó ${formatMinutes(lateMin)} después de la hora original (${formatHHMM(originalAt)}).`;
  return {
    status: "EN_REVISION",
    reason,
    alerts,
    distanceM: base.distanceM,
    similarity: base.similarity,
    syncLateMin: lateMin,
  };
}
