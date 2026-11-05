import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { REVIEWER } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// POST /api/checkins/[id]/review
// Body: { decision: "APROBADA" | "RECHAZADA", note: string, reviewer?: string }
// Registra la decisión humana con usuario, fecha y motivo (trazabilidad,
// brief §3.3) y resuelve las alertas pendientes asociadas.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const { decision, note } = body;
  if (decision !== "APROBADA" && decision !== "RECHAZADA") {
    return NextResponse.json(
      { error: "decision debe ser APROBADA o RECHAZADA." },
      { status: 400 },
    );
  }
  if (!note || String(note).trim().length < 3) {
    return NextResponse.json(
      { error: "Debes escribir un motivo (mínimo 3 caracteres)." },
      { status: 400 },
    );
  }

  const checkin = await db.checkIn.findUnique({
    where: { id },
    include: { alerts: true },
  });
  if (!checkin) {
    return NextResponse.json({ error: "Marcación no encontrada." }, { status: 404 });
  }
  if (checkin.reviewedBy) {
    return NextResponse.json(
      { error: "Esta marcación ya fue revisada." },
      { status: 409 },
    );
  }

  const reviewer = String(body.reviewer ?? REVIEWER).trim() || REVIEWER;
  const now = new Date();

  const [updated] = await db.$transaction([
    db.checkIn.update({
      where: { id },
      data: {
        status: decision,
        reviewedBy: reviewer,
        reviewedAt: now,
        reviewNote: String(note).trim(),
      },
      include: {
        worker: { select: { id: true, name: true, avatarHue: true, position: true } },
        alerts: true,
      },
    }),
    db.alert.updateMany({
      where: { checkInId: id, status: "PENDIENTE" },
      data: {
        status: "RESUELTA",
        resolvedBy: reviewer,
        resolvedAt: now,
        resolutionNote: `${decision === "APROBADA" ? "Marcación aprobada" : "Marcación rechazada"}: ${String(note).trim()}`,
      },
    }),
  ]);

  return NextResponse.json({ checkin: updated });
}
