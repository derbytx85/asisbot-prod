import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CONSENT_VERSION } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// POST /api/consent — aceptación del consentimiento informado (mejora §1).
// Guarda la aceptación con fecha y versión del texto. Nadie puede marcar por
// primera vez sin este registro (POST /api/checkins lo exige).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const workerId = String(body.workerId ?? "");
  if (!workerId) {
    return NextResponse.json({ error: "workerId es obligatorio." }, { status: 400 });
  }

  const worker = await db.worker.findUnique({ where: { id: workerId } });
  if (!worker) {
    return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
  }

  const existing = await db.consent.findFirst({
    where: { workerId, version: CONSENT_VERSION },
  });
  if (existing) {
    return NextResponse.json({
      consent: { id: existing.id, version: existing.version, acceptedAt: existing.acceptedAt },
      already: true,
    });
  }

  const consent = await db.consent.create({
    data: { workerId, version: CONSENT_VERSION },
  });

  return NextResponse.json(
    {
      consent: { id: consent.id, version: consent.version, acceptedAt: consent.acceptedAt },
      already: false,
    },
    { status: 201 },
  );
}

// GET /api/consent?workerId= — estado del consentimiento del trabajador
export async function GET(req: NextRequest) {
  const workerId = req.nextUrl.searchParams.get("workerId");
  if (!workerId) {
    return NextResponse.json({ error: "workerId es obligatorio." }, { status: 400 });
  }
  const consents = await db.consent.findMany({
    where: { workerId },
    orderBy: { acceptedAt: "desc" },
    take: 1,
  });
  return NextResponse.json({
    consent: consents[0]
      ? { version: consents[0].version, acceptedAt: consents[0].acceptedAt }
      : null,
  });
}
