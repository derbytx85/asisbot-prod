import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/alerts/[id]/resolve — marcar alerta como resuelta (con nota)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = body?.note ? String(body.note).trim() : null;
  if (note !== null && note.length < 3) {
    return NextResponse.json(
      { error: "La nota debe tener al menos 3 caracteres." },
      { status: 400 },
    );
  }

  const alert = await db.alert.findUnique({ where: { id } });
  if (!alert) {
    return NextResponse.json({ error: "Alerta no encontrada." }, { status: 404 });
  }
  if (alert.status === "RESUELTA") {
    return NextResponse.json({ error: "La alerta ya está resuelta." }, { status: 409 });
  }

  const updated = await db.alert.update({
    where: { id },
    data: {
      status: "RESUELTA",
      resolvedBy: "M. Contreras · RR.HH.",
      resolvedAt: new Date(),
      resolutionNote: note ?? "Alerta revisada y cerrada por RR.HH.",
    },
    include: {
      checkIn: {
        include: {
          worker: {
            select: { id: true, name: true, avatarHue: true, position: true },
          },
        },
      },
    },
  });
  return NextResponse.json({ alert: updated });
}
