import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const text = String(body.text ?? "").trim();
  if (text.length < 3) return NextResponse.json({ error: "Escribe tu explicación (mínimo 3 caracteres)." }, { status: 400 });

  const { data: checkin } = await supabase.from("CheckIn").select("*").eq("id", id).single();
  if (!checkin) return NextResponse.json({ error: "Marcación no encontrada." }, { status: 404 });
  if (checkin.pendingSync) return NextResponse.json({ error: "La marca aún no llega al sistema (sin señal)." }, { status: 409 });
  if (checkin.status === "RECHAZADA" || checkin.reviewedBy) return NextResponse.json({ error: "Esta marca ya fue resuelta; no admite más explicaciones." }, { status: 409 });

  const prev = checkin.workerNote ? `${checkin.workerNote}\n— ` : "";
  const { data: updated, error } = await supabase.from("CheckIn")
    .update({ workerNote: `${prev}${text}` }).eq("id", id)
    .select("*, worker:Worker(id,name,avatarHue,position), alerts:Alert(*)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checkin: updated });
}
