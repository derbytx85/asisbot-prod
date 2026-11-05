import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { seedDemoData } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await seedDemoData(supabase);
  return NextResponse.json({ ok: true, ...result });
}
