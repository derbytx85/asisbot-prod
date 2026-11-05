import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CONSENT_VERSION } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const workerId = String(body.workerId ?? "");
  if (!workerId) return NextResponse.json({ error: "workerId es obligatorio." }, { status: 400 });

  const { data: worker } = await supabase.from("Worker").select("id").eq("id", workerId).single();
  if (!worker) return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });

  const { data: existing } = await supabase.from("Consent").select("*").eq("workerId", workerId).eq("version", CONSENT_VERSION).single();
  if (existing) return NextResponse.json({ consent: { id: existing.id, version: existing.version, acceptedAt: existing.acceptedAt }, already: true });

  const { data: consent, error } = await supabase.from("Consent").insert({ workerId, version: CONSENT_VERSION }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ consent: { id: consent.id, version: consent.version, acceptedAt: consent.acceptedAt }, already: false }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const workerId = req.nextUrl.searchParams.get("workerId");
  if (!workerId) return NextResponse.json({ error: "workerId es obligatorio." }, { status: 400 });
  const { data } = await supabase.from("Consent").select("*").eq("workerId", workerId).order("acceptedAt", { ascending: false }).limit(1);
  return NextResponse.json({ consent: data?.[0] ? { version: data[0].version, acceptedAt: data[0].acceptedAt } : null });
}
