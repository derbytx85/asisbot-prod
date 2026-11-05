import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = body?.note ? String(body.note).trim() : null;
  if (note !== null && note.length < 3)
    return NextResponse.json({ error: "La nota debe tener al menos 3 caracteres." }, { status: 400 });

  const { data: alert } = await supabase.from("Alert").select("*").eq("id", id).single();
  if (!alert) return NextResponse.json({ error: "Alerta no encontrada." }, { status: 404 });
  if (alert.status === "RESUELTA") return NextResponse.json({ error: "La alerta ya está resuelta." }, { status: 409 });

  const { data: updated, error } = await supabase
    .from("Alert")
    .update({ status: "RESUELTA", resolvedBy: "M. Contreras · RR.HH.", resolvedAt: new Date().toISOString(), resolutionNote: note ?? "Alerta revisada y cerrada por RR.HH." })
    .eq("id", id)
    .select("*, checkIn:CheckIn(*, worker:Worker(id,name,avatarHue,position))")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: updated });
}
