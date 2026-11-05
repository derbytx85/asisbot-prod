import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// PATCH /api/workers/[id] — editar o desactivar trabajador
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const data: Record<string, unknown> = {};
  const allowed = [
    "name",
    "rut",
    "position",
    "phone",
    "zoneId",
    "scheduleStart",
    "scheduleEnd",
    "avatarHue",
    "active",
  ] as const;
  for (const k of allowed) {
    if (k in body) data[k] = body[k];
  }
  if ("zoneId" in body && !body.zoneId) data.zoneId = null;
  if ("name" in data && !String(data.name).trim()) {
    return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
  }

  try {
    const worker = await db.worker.update({
      where: { id },
      data,
      include: { zone: true },
    });
    return NextResponse.json({ worker });
  } catch {
    return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
  }
}

// GET /api/workers/[id] — detalle con últimas marcaciones
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const worker = await db.worker.findUnique({
    where: { id },
    include: {
      zone: true,
      checkins: {
        orderBy: { timestamp: "desc" },
        take: 20,
        include: { alerts: true },
      },
    },
  });
  if (!worker) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ worker });
}
