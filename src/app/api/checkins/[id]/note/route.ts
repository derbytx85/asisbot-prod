import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/checkins/[id]/note — explicación del trabajador (mejora §5).
// Desde el simulador, el trabajador puede dejar un comentario en una marca
// en revisión; queda adjunto al historial de la marca.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const text = String(body.text ?? "").trim();
  if (text.length < 3) {
    return NextResponse.json(
      { error: "Escribe tu explicación (mínimo 3 caracteres)." },
      { status: 400 },
    );
  }

  const checkin = await db.checkIn.findUnique({ where: { id } });
  if (!checkin) {
    return NextResponse.json({ error: "Marcación no encontrada." }, { status: 404 });
  }
  if (checkin.pendingSync) {
    return NextResponse.json(
      { error: "La marca aún no llega al sistema (sin señal)." },
      { status: 409 },
    );
  }
  if (checkin.status === "RECHAZADA" || checkin.reviewedBy) {
    return NextResponse.json(
      { error: "Esta marca ya fue resuelta; no admite más explicaciones." },
      { status: 409 },
    );
  }

  const prev = checkin.workerNote ? `${checkin.workerNote}\n— ` : "";
  const updated = await db.checkIn.update({
    where: { id },
    data: { workerNote: `${prev}${text}` },
    include: {
      worker: { select: { id: true, name: true, avatarHue: true, position: true } },
      alerts: true,
    },
  });

  return NextResponse.json({ checkin: updated });
}
