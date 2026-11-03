import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  evaluateCheckIn,
  evaluateSyncLate,
  type CheckType,
  type SelfieKind,
} from "@/lib/attendance";
import { chileInstant, chileToday } from "@/lib/tz";

export const dynamic = "force-dynamic";

// POST /api/checkins/[id]/sync — sincroniza una marca hecha sin señal (mejora §4).
// Se evalúa con la HORA ORIGINAL de la marca (nunca se reescribe) y se registra
// la hora de sincronización por separado. Si llegó tarde (>30 min), queda
// "por revisar" con ambas horas visibles.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const pendiente = await db.checkIn.findUnique({
    where: { id },
    include: { worker: { include: { zone: true } } },
  });
  if (!pendiente) {
    return NextResponse.json({ error: "Marcación no encontrada." }, { status: 404 });
  }
  if (!pendiente.pendingSync) {
    return NextResponse.json(
      { error: "Esta marcación ya fue sincronizada." },
      { status: 409 },
    );
  }

  const syncedAt = new Date();
  const originalAt = pendiente.timestamp;

  const t = chileToday();
  const start = chileInstant(t.year, t.month, t.day, 0, 0);
  const end = chileInstant(t.year, t.month, t.day + 1, 0, 0);
  const todays = await db.checkIn.findMany({
    where: { workerId: pendiente.workerId, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: "asc" },
  });

  const sameType = (pendiente.type as CheckType) === "ENTRADA" ? "ENTRADA" : "SALIDA";
  // Las otras marcas pendientes de sync aún no llegaron al sistema (mejora §4)
  const synced = todays.filter((c) => !c.pendingSync);
  const lastSameTypeToday =
    [...synced].reverse().find((c) => c.type === sameType && c.id !== id) ?? null;
  const firstEntradaToday =
    synced.find(
      (c) =>
        c.type === "ENTRADA" &&
        c.status !== "RECHAZADA" &&
        c.status !== "PENDIENTE_SYNC" &&
        c.id !== id,
    ) ?? null;
  const prevMarkToday =
    [...synced]
      .reverse()
      .find(
        (c) =>
          c.id !== id &&
          c.timestamp.getTime() < originalAt.getTime() &&
          c.lat !== null &&
          c.lng !== null,
      ) ?? null;

  const base = evaluateCheckIn({
    workerId: pendiente.workerId,
    type: pendiente.type as CheckType,
    now: originalAt, // ← se evalúa con la hora ORIGINAL, nunca con la de sync
    lat: pendiente.lat,
    lng: pendiente.lng,
    selfieKind: (pendiente.selfieKind ?? null) as SelfieKind | null,
    zone: pendiente.worker.zone
      ? {
          name: pendiente.worker.zone.name,
          lat: pendiente.worker.zone.lat,
          lng: pendiente.worker.zone.lng,
          radiusM: pendiente.worker.zone.radiusM,
        }
      : null,
    scheduleStart: pendiente.worker.scheduleStart,
    lastSameTypeToday: lastSameTypeToday
      ? { timestamp: lastSameTypeToday.timestamp }
      : null,
    firstEntradaToday,
    prevMarkToday: prevMarkToday
      ? { timestamp: prevMarkToday.timestamp, lat: prevMarkToday.lat, lng: prevMarkToday.lng }
      : null,
  });

  const result = evaluateSyncLate(base, originalAt, syncedAt);

  const updated = await db.checkIn.update({
    where: { id },
    data: {
      status: result.status,
      distanceM: result.distanceM,
      similarity: result.similarity,
      reason: result.reason,
      pendingSync: false,
      syncAt: syncedAt,
    },
  });

  const createdAlerts = [];
  for (const a of result.alerts) {
    createdAlerts.push(
      await db.alert.create({
        data: { checkInId: id, type: a.type, message: a.message },
      }),
    );
  }

  return NextResponse.json({
    checkin: {
      ...updated,
      worker: {
        id: pendiente.worker.id,
        name: pendiente.worker.name,
        avatarHue: pendiente.worker.avatarHue,
        position: pendiente.worker.position,
      },
    },
    alerts: createdAlerts,
    result: {
      status: result.status,
      reason: result.reason,
      similarity: result.similarity,
      distanceM: result.distanceM,
      syncLateMin: result.syncLateMin ?? null,
    },
  });
}
