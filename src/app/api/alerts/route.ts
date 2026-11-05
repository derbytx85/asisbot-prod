import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { chileInstant, chileToday } from "@/lib/tz";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "today";
  const status = sp.get("status");
  const type = sp.get("type");

  let query = supabase
    .from("Alert")
    .select("*, checkIn:CheckIn(*, worker:Worker(id,name,avatarHue,position))")
    .order("createdAt", { ascending: false })
    .limit(200);

  if (scope === "today") {
    const t = chileToday();
    query = query
      .gte("createdAt", chileInstant(t.year, t.month, t.day, 0, 0).toISOString())
      .lt("createdAt", chileInstant(t.year, t.month, t.day + 1, 0, 0).toISOString());
  }
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);

  const { data: alerts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: resolved } = await supabase
    .from("Alert")
    .select("*, checkIn:CheckIn(status)")
    .eq("status", "RESUELTA")
    .neq("type", "ATRASO");

  const falsePositives = (resolved ?? []).filter((a) => a.checkIn?.status === "APROBADA").length;
  const fpSummary = {
    resolved: (resolved ?? []).length,
    falsePositives,
    ratePct: (resolved ?? []).length > 0 ? Math.round((falsePositives / (resolved ?? []).length) * 100) : 0,
  };

  return NextResponse.json({ alerts, fpSummary });
}
