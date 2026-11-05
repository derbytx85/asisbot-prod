import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: corrections, error } = await supabase
    .from("Correction")
    .select("*, checkIn:CheckIn(id,type,timestamp,worker:Worker(id,name,avatarHue,position))")
    .order("correctedAt", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ corrections });
}
