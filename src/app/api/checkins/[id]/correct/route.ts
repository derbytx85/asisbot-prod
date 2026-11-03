import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { REVIEWER, formatHHMM } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// POST /api/checkins/[id]/correct — corrección desde el panel (mejora §2).
// El supervisor/RR.HH. corrige hora y/o estado indicando motivo OBLIGATORIO.
// La marca original nunca se borra: cada cambio queda en el historial de
// correcciones (quién, cuándo, valor anterior, valor nuevo, motivo).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const reason = String(body.reason ?? "").trim();
  if (reason.length < 3) {
    return NextResponse.json(
      { error: "Debes escribir el motivo de la corrección (mínimo 3 caracteres)." },
      { status: 400 },
    );
  }

  const { newTimestamp, newStatus } = body;
  const wantsTime = newTimestamp !== undefined && newTimestamp !== null && newTimestamp !== "";
  const wantsStatus = newStatus === "APROBADA" || newStatus === "RECHAZADA";
  if (!wantsTime && !wantsStatus) {
    return NextResponse.json(
      { error: "Indica la nueva hora y/o el nuevo estado para corregir." },
      { status: 400 },
    );
  }

  const checkin = await db.checkIn.findUnique({ where: { id } });
  if (!checkin) {
    return NextResponse.json({ error: "Marcación no encontrada." }, { status: 404 });
  }
  if (checkin.pendingSync) {
    return NextResponse.json(
      { error: "La marca aún está pendiente de sincronizar (sin señal)." },
      { status: 409 },
    );
  }

  const correctedBy = String(body.correctedBy ?? REVIEWER).trim() || REVIEWER;
  const now = new Date();

  const data: Record<string, unknown> = {};
  const corrections: Array<{ field: string; oldValue: string; newValue: string }> = [];

  if (wantsTime) {
    const parsed = new Date(String(newTimestamp));
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "La nueva hora es inválida." }, { status: 400 });
    }
    if (parsed.getTime() !== checkin.timestamp.getTime()) {
      data.timestamp = parsed;
      corrections.push({
        field: "timestamp",
        oldValue: formatHHMM(checkin.timestamp),
        newValue: formatHHMM(parsed),
      });
    }
  }
  if (wantsStatus && newStatus !== checkin.status) {
    data.status = newStatus;
    corrections.push({
      field: "status",
      oldValue: checkin.status,
      newValue: newStatus,
    });
  }

  if (corrections.length === 0) {
    return NextResponse.json(
      { error: "No hay cambios que corregir (los valores son iguales)." },
      { status: 400 },
    );
  }

  // Una corrección es una decisión humana: cierra la revisión y resuelve
  // las alertas pendientes asociadas (igual que aprobar/rechazar).
  if (!checkin.reviewedBy) {
    data.reviewedBy = correctedBy;
    data.reviewedAt = now;
    data.reviewNote = `Corregida (${corrections
      .map((c) => `${c.field} ${c.oldValue}→${c.newValue}`)
      .join(", ")}): ${reason}`;
  }
  data.alerts = {
    updateMany: {
      where: { checkInId: id, status: "PENDIENTE" },
      data: {
        status: "RESUELTA",
        resolvedBy: correctedBy,
        resolvedAt: now,
        resolutionNote: `Marcación corregida: ${reason}`,
      },
    },
  };

  const [updated] = await db.$transaction([
    db.checkIn.update({
      where: { id },
      data,
      include: {
        worker: { select: { id: true, name: true, avatarHue: true, position: true } },
        alerts: true,
        corrections: { orderBy: { correctedAt: "desc" } },
      },
    }),
    ...corrections.map((c) =>
      db.correction.create({
        data: {
          checkInId: id,
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          reason,
          correctedBy,
        },
      }),
    ),
  ]);

  return NextResponse.json({ checkin: updated, corrections });
}
