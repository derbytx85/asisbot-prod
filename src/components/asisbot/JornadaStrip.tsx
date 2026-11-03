"use client";

// ─── Línea de jornada (elemento distintivo de AsisBot) ──────────────────────
// Por cada trabajador: la franja del horario asignado y, sobre ella, la marca
// de entrada y de salida. Responde de un vistazo "¿quién está dentro de su
// horario y desde cuándo?", cosa que ningún tablero genérico muestra.

import { chileWallMinutes, fmtHHMM } from "./format";

interface Props {
  scheduleStart: string;
  scheduleEnd: string;
  entrada: string | null;
  salida: string | null;
  /** minutos de pared chilena actuales, para cortar la barra en "ahora" */
  nowMin: number;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function JornadaStrip({ scheduleStart, scheduleEnd, entrada, salida, nowMin }: Props) {
  const start = toMin(scheduleStart);
  const end = toMin(scheduleEnd);
  const span = Math.max(end - start, 1);

  const eMin = entrada ? chileWallMinutes(entrada) : null;
  const sMin = salida ? chileWallMinutes(salida) : null;

  const pct = (m: number) => Math.min(100, Math.max(0, ((m - start) / span) * 100));

  const fillFrom = eMin !== null ? pct(eMin) : null;
  const rawTo = sMin ?? Math.min(nowMin, end);
  const fillTo = eMin !== null ? pct(Math.max(rawTo, eMin)) : null;

  return (
    <div
      className="relative h-1.5 w-full rounded-full bg-[#e7eae7]"
      role="img"
      aria-label={`Horario ${scheduleStart} a ${scheduleEnd}. Entrada ${fmtHHMM(entrada)}, salida ${fmtHHMM(salida)}`}
    >
      {fillFrom !== null && fillTo !== null && (
        <div
          className="absolute inset-y-0 rounded-full bg-[var(--accent)]"
          style={{ left: `${fillFrom}%`, width: `${Math.max(fillTo - fillFrom, 1)}%` }}
        />
      )}
      {eMin !== null && (
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)]"
          style={{ left: `${pct(eMin)}%` }}
          title={`Entrada ${fmtHHMM(entrada)}`}
        />
      )}
      {sMin !== null && (
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1b1e1b]"
          style={{ left: `${pct(sMin)}%` }}
          title={`Salida ${fmtHHMM(salida)}`}
        />
      )}
    </div>
  );
}
