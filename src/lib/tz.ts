// Helpers de zona horaria Chile (America/Santiago) para el prototipo.
// El seed y la API construyen instants UTC a partir de hora de pared chilena,
// de modo que el navegador del usuario (America/Santiago) muestre HH:MM correctas.

export const CHILE_TZ = "America/Santiago";

/** Offset (ms) de la zona horaria `tz` en el instante dado. */
export function tzOffsetMs(date: Date, tz: string = CHILE_TZ): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUTC - date.getTime();
}

/** Componentes de fecha/hora de pared en Chile para un instante. */
export function chileParts(date: Date = new Date()) {
  const off = tzOffsetMs(date);
  const shifted = new Date(date.getTime() + off);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1, // 1-12
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(), // 0 domingo
  };
}

/** Construye el instante UTC que corresponde a (y, m, d, hh, mm) hora Chile. */
export function chileInstant(
  y: number,
  m: number, // 1-12
  d: number,
  hh = 0,
  mm = 0,
): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = tzOffsetMs(guess);
  return new Date(guess.getTime() - off);
}

/** (year, month, day) de hoy en Chile. */
export function chileToday(now: Date = new Date()) {
  const p = chileParts(now);
  return { year: p.year, month: p.month, day: p.day };
}

/** Fecha de hoy en Chile menos `n` días, con hora de pared (hh, mm). */
export function chileDaysAgoAt(
  n: number,
  hh: number,
  mm: number,
  now: Date = new Date(),
): Date {
  const t = chileToday(now);
  const base = new Date(Date.UTC(t.year, t.month - 1, t.day - n));
  return chileInstant(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    hh,
    mm,
  );
}
