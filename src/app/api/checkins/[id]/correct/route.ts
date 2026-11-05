import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { REVIEWER, formatHHMM } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const reason = String(body.reason ?? "").trim();
  if (reason.length < 3) return NextResponse.json({ error: "Debes escribir el motivo de la corrección (mínimo 3 caracteres)." }, { status: 400 });

  const { newTimestamp, newStatus } = body;
  const wantsTime = newTimestamp !== undefined && newTimestamp !== null && newTimestamp !== "";
  const wantsStatus = newStatus === "APROBADA" || newStatus === "RECHAZADA";
  if (!wantsTime && !wantsStatus) return NextResponse.json({ error: "Indica la nueva hora y/o el nuevo estado para corregir." }, { status: 400 });

  const { data: checkin } = await supabase.from("CheckIn").select("*").eq("id", id).single();
  if (!checkin) return NextResponse.json({ error: "Marcación no encontrada." }, { status: 404 });
  if (checkin.pendingSync) return NextResponse.json({ error: "La marca aún está pendiente de sincronizar (sin señal)." }, { status: 409 });

  const correctedBy = String(body.correctedBy ?? REVIEWER).trim() || REVIEWER;
  const now = new Date();
  const data: Record<string, unknown> = {};
  const corrections: Array<{ field: string; oldValue: string; newValue: string }> = [];

  if (wantsTime) {
    const parsed = new Date(String(newTimestamp));
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "La nueva hora es inválida." }, { status: 400 });
    if (parsed.getTime() !== new Date(checkin.timestamp).getTime()) {
      data.timestamp = parsed.toISOString();
      corrections.push({ field: "timestamp", oldValue: formatHHMM(new Date(checkin.timestamp)), newValue: formatHHMM(parsed) });
    }
  }
  if (wantsStatus && newStatus !== checkin.status) {
    data.status = newStatus;
    corrections.push({ field: "status", oldValue: checkin.status, newValue: newStatus });
  }
  if (corrections.length === 0) return NextResponse.json({ error: "No hay cambios que corregir (los valores son iguales)." }, { status: 400 });

  if (!checkin.reviewedBy) {
    data.reviewedBy = correctedBy;
    data.reviewedAt = now.toISOString();
    data.reviewNote = `Corregida (${corrections.map((c) => `${c.field} ${c.oldValue}→${c.newValue}`).join(", ")}): ${reason}`;
  }

  const nowIso = now.toISOString();
  await Promise.all([
    supabase.from("Alert").update({ status: "RESUELTA", resolvedBy: correctedBy, resolvedAt: nowIso, resolutionNote: `Marcación corregida: ${reason}` })
      .eq("checkInId", id).eq("status", "PENDIENTE"),
    ...corrections.map((c) => supabase.from("Correction").insert({ checkInId: id, field: c.field, oldValue: c.oldValue, newValue: c.newValue, reason, correctedBy })),
  ]);

  const { data: updated, error } = await supabase.from("CheckIn").update(data).eq("id", id)
    .select("*, worker:Worker(id,name,avatarHue,position), alerts:Alert(*), corrections:Correction(*)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checkin: updated, corrections });
}
