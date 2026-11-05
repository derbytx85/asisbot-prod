import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { REVIEWER } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const { decision, note } = body;
  if (decision !== "APROBADA" && decision !== "RECHAZADA")
    return NextResponse.json({ error: "decision debe ser APROBADA o RECHAZADA." }, { status: 400 });
  if (!note || String(note).trim().length < 3)
    return NextResponse.json({ error: "Debes escribir un motivo (mínimo 3 caracteres)." }, { status: 400 });

  const { data: checkin } = await supabase.from("CheckIn").select("*, alerts:Alert(*)").eq("id", id).single();
  if (!checkin) return NextResponse.json({ error: "Marcación no encontrada." }, { status: 404 });
  if (checkin.reviewedBy) return NextResponse.json({ error: "Esta marcación ya fue revisada." }, { status: 409 });

  const reviewer = String(body.reviewer ?? REVIEWER).trim() || REVIEWER;
  const now = new Date().toISOString();
  const resolutionNote = `${decision === "APROBADA" ? "Marcación aprobada" : "Marcación rechazada"}: ${String(note).trim()}`;

  const [{ data: updated }, ] = await Promise.all([
    supabase.from("CheckIn").update({ status: decision, reviewedBy: reviewer, reviewedAt: now, reviewNote: String(note).trim() })
      .eq("id", id).select("*, worker:Worker(id,name,avatarHue,position), alerts:Alert(*)").single(),
    supabase.from("Alert").update({ status: "RESUELTA", resolvedBy: reviewer, resolvedAt: now, resolutionNote })
      .eq("checkInId", id).eq("status", "PENDIENTE"),
  ]);

  return NextResponse.json({ checkin: updated });
}
