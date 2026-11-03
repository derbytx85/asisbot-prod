// Formato de fechas/horas en hora de pared chilena, desde el navegador.
// Los instantes guardados son UTC correctos para America/Santiago, así que
// formatear con esa zona muestra la hora real de marcación en cualquier equipo.

const TZ = "America/Santiago";

export function fmtHHMM(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function chileWallMinutes(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

export function chileDayKeyOf(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return parts; // en-CA → YYYY-MM-DD
}

/** "Hoy 08:05" · "Ayer 18:02" · "24-10 14:33" */
export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const key = chileDayKeyOf(iso);
  const nowKey = chileDayKeyOf(new Date().toISOString());
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const yKey = chileDayKeyOf(yesterday);
  const hhmm = fmtHHMM(iso);
  if (key === nowKey) return `Hoy ${hhmm}`;
  if (key === yKey) return `Ayer ${hhmm}`;
  return `${key.slice(8, 10)}-${key.slice(5, 7)} ${hhmm}`;
}

/** "2026-10-27" → "lun 27 oct" */
export function fmtDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dt);
}

/** 504 → "8 h 24 min" · 42 → "42 min" */
export function fmtMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (a + b).toUpperCase();
}
