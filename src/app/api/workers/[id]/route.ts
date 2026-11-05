import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: worker, error } = await supabase
    .from("Worker")
    .select("*, zone:Zone(*), checkins:CheckIn(*, alerts:Alert(*))")
    .eq("id", id)
    .order("timestamp", { referencedTable: "CheckIn", ascending: false })
    .limit(20, { referencedTable: "CheckIn" })
    .single();
  if (error || !worker) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ worker });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const allowed = ["name","rut","position","phone","zoneId","scheduleStart","scheduleEnd","avatarHue","active"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  if ("zoneId" in body && !body.zoneId) data.zoneId = null;
  if ("name" in data && !String(data.name).trim())
    return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
  const { data: worker, error } = await supabase
    .from("Worker").update(data).eq("id", id).select("*, zone:Zone(*)").single();
  if (error || !worker) return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
  return NextResponse.json({ worker });
}
