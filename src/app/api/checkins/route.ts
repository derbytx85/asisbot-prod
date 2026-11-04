import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  evaluateCheckIn,
  type CheckType,
  type SelfieKind,
} from "@/lib/attendance";
import { chileInstant, chileToday } from "@/lib/tz";

export const dynamic = "force-dynamic";

// GET /api/checkins?scope=today|all&workerId=&status=&reviewed=1
// reviewed=1 → solo marcaciones ya revisadas (auditoría), por fecha de revisión
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "today";
  const workerId = sp.get("workerId");
  const status = sp.get("status");
  const reviewed = sp.get("reviewed");

  const where: Record<string, unknown> = {};
  if (reviewed === "1") {
    where.reviewedAt = { not: null };
  } else if (scope === "today") {
    const t = chileToday();
    where.timestamp = {
      gte: chileInstant(t.year, t.month, t.day, 0, 0),
      lt: chileInstant(t.year, t.month, t.day + 1, 0, 0),
    };
  }
  if (workerId) where.workerId = workerId;
  if (status) where.status = status;

  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage = Math.min(Math.max(Number(sp.get("perPage") ?? 200), 1), 1000);
  const total = await db.checkIn.count({ where });
  const checkins = await db.checkIn.findMany({
    where,
    include: {
      worker: { select: { id: true, name: true, avatarHue: true, position: true } },
      alerts: true,
      corrections: { orderBy: { correctedAt: "desc" } },
    },
    orderBy: reviewed === "1" ? { reviewedAt: "desc" } : { timestamp: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
  });
  return NextResponse.json({ checkins, total, page, perPage });
}

// POST /api/checkins — marcación simulada desde el chat de WhatsApp.
// Body: { workerId, type: ENTRADA|SALIDA, lat?, lng?, selfieKind?: referencia|otra|galeria,
//         demoAt?, offline? }
// offline=true → marca tolerante a mala señal (mejora §4): se guarda como
// PENDIENTE_SYNC en el teléfono; se evalúa recién al sincronizar.
// Ejecuta el motor de verificación simulado y crea las alertas que correspondan.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const { workerId, type, lat, lng, selfieKind, offline } = body;
  if (!workerId || (type !== "ENTRADA" && type !== "SALIDA")) {
    return NextResponse.json(
      { error: "workerId y type (ENTRADA|SALIDA) son obligatorios." },
      { status: 400 },
    );
  }
  if (
    selfieKind !== undefined &&
    selfieKind !== null &&
    selfieKind !== "referencia" &&
    selfieKind !== "otra" &&
    selfieKind !== "galeria"
  ) {
    return NextResponse.json({ error: "selfieKind inválido." }, { status: 400 });
  }

  const worker = await db.worker.findUnique({
    where: { id: workerId },
    include: { zone: true, consents: { orderBy: { acceptedAt: "desc" }, take: 1 } },
  });
  if (!worker) {
    return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
  }
  if (!worker.active) {
    return NextResponse.json(
      { error: "El trabajador está desactivado." },
      { status: 409 },
    );
  }
  // Mejora §1: nadie marca por primera vez sin consentimiento explícito.
  if (worker.consents.length === 0) {
    return NextResponse.json(
      {
        error: "Este trabajador aún no ha aceptado el consentimiento de privacidad.",
        code: "CONSENT_REQUIRED",
      },
      { status: 403 },
    );
  }

  // "now" real; los casos demo pueden pasar una hora simulada (demoAt)
  // para que los casos del brief sean reproducibles a cualquier hora.
  const now = body.demoAt ? new Date(String(body.demoAt)) : new Date();
  if (Number.isNaN(now.getTime())) {
    return NextResponse.json({ error: "demoAt inválido." }, { status: 400 });
  }

  const t = chileToday();
  const start = chileInstant(t.year, t.month, t.day, 0, 0);
  const end = chileInstant(t.year, t.month, t.day + 1, 0, 0);
  const todays = await db.checkIn.findMany({
    where: { workerId, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: "asc" },
  });

  const latN = lat === undefined || lat === null ? null : Number(lat);
  const lngN = lng === undefined || lng === null ? null : Number(lng);
  const hasPos = latN !== null && lngN !== null && Number.isFinite(latN) && Number.isFinite(lngN);

  // ── Marca sin señal (mejora §4): queda en el teléfono, sin evaluación ──
  if (offline === true) {
    const pendiente = await db.checkIn.create({
      data: {
        workerId,
        type: type as CheckType,
        timestamp: now,
        lat: hasPos ? latN : null,
        lng: hasPos ? lngN : null,
        status: "PENDIENTE_SYNC",
        similarity: null,
        selfieKind: selfieKind ?? null,
        pendingSync: true,
        reason: `Guardada en el teléfono sin señal a las ${now.toISOString()}. Se enviará cuando vuelva la cobertura; conserva su hora original.`,
      },
    });
    return NextResponse.json(
      {
        checkin: {
          ...pendiente,
          worker: { id: worker.id, name: worker.name, avatarHue: worker.avatarHue, position: worker.position },
        },
        alerts: [],
        result: {
          status: "PENDIENTE_SYNC",
          reason: pendiente.reason,
          similarity: null,
          distanceM: null,
        },
      },
      { status: 201 },
    );
  }

  const sameType = (type as CheckType) === "ENTRADA" ? "ENTRADA" : "SALIDA";
  // Las marcas pendientes de sync aún no llegaron al sistema: no cuentan para
  // duplicados ni como entrada previa (mejora §4).
  const synced = todays.filter((c) => !c.pendingSync);
  const lastSameTypeToday =
    [...synced].reverse().find((c) => c.type === sameType) ?? null;
  const firstEntradaToday =
    synced.find(
      (c) => c.type === "ENTRADA" && c.status !== "RECHAZADA" && c.status !== "PENDIENTE_SYNC",
    ) ?? null;
  // Última marca anterior con posición (cualquier tipo): coherencia (mejora §5)
  const prevMarkToday =
    [...synced]
      .reverse()
      .find((c) => c.timestamp.getTime() < now.getTime() && c.lat !== null && c.lng !== null) ??
    null;

  const result = evaluateCheckIn({
    workerId,
    type: type as CheckType,
    now,
    lat: hasPos ? latN : null,
    lng: hasPos ? lngN : null,
    selfieKind: (selfieKind ?? null) as SelfieKind | null,
    zone: worker.zone
      ? {
          name: worker.zone.name,
          lat: worker.zone.lat,
          lng: worker.zone.lng,
          radiusM: worker.zone.radiusM,
        }
      : null,
    scheduleStart: worker.scheduleStart,
    lastSameTypeToday: lastSameTypeToday
      ? { timestamp: lastSameTypeToday.timestamp }
      : null,
    firstEntradaToday,
    prevMarkToday: prevMarkToday
      ? {
          timestamp: prevMarkToday.timestamp,
          lat: prevMarkToday.lat,
          lng: prevMarkToday.lng,
        }
      : null,
  });

  const checkin = await db.checkIn.create({
    data: {
      workerId,
      type: type as CheckType,
      timestamp: now,
      lat: hasPos ? latN : null,
      lng: hasPos ? lngN : null,
      distanceM: result.distanceM,
      status: result.status,
      similarity: result.similarity,
      selfieKind: selfieKind ?? null,
      reason: result.reason,
    },
  });

  const createdAlerts = [];
  for (const a of result.alerts) {
    createdAlerts.push(
      await db.alert.create({
        data: { checkInId: checkin.id, type: a.type, message: a.message },
      }),
    );
  }

  return NextResponse.json(
    {
      checkin: {
        ...checkin,
        worker: { id: worker.id, name: worker.name, avatarHue: worker.avatarHue, position: worker.position },
      },
      alerts: createdAlerts,
      result: {
        status: result.status,
        reason: result.reason,
        similarity: result.similarity,
        distanceM: result.distanceM,
      },
    },
    { status: 201 },
  );
}
