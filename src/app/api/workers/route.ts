import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/workers — lista completa (incluye inactivos) + consentimiento (mejora §1)
export async function GET() {
  const workers = await db.worker.findMany({
    include: {
      zone: true,
      consents: { orderBy: { acceptedAt: "desc" }, take: 1 },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({
    workers: workers.map((w) => ({
      ...w,
      consent: w.consents[0]
        ? { version: w.consents[0].version, acceptedAt: w.consents[0].acceptedAt }
        : null,
    })),
  });
}

// POST /api/workers — crear trabajador (rol admin demo)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const { name, rut, position, phone, zoneId, scheduleStart, scheduleEnd, avatarHue } = body;
  if (!name?.trim() || !position?.trim() || !phone?.trim()) {
    return NextResponse.json(
      { error: "Nombre, cargo y teléfono son obligatorios." },
      { status: 400 },
    );
  }
  if (!/^\d{2}:\d{2}$/.test(scheduleStart ?? "") || !/^\d{2}:\d{2}$/.test(scheduleEnd ?? "")) {
    return NextResponse.json(
      { error: "Horario inválido (formato HH:MM)." },
      { status: 400 },
    );
  }

  const hue =
    typeof avatarHue === "number"
      ? avatarHue
      : Math.floor(Math.random() * 360);

  const worker = await db.worker.create({
    data: {
      name: String(name).trim(),
      rut: rut ? String(rut).trim() : "—",
      position: String(position).trim(),
      phone: String(phone).trim(),
      zoneId: zoneId || null,
      scheduleStart,
      scheduleEnd,
      avatarHue: ((hue % 360) + 360) % 360,
    },
    include: { zone: true },
  });
  return NextResponse.json({ worker }, { status: 201 });
}
