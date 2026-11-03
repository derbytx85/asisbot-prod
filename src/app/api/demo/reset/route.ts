import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDemoData } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

// POST /api/demo/reset — repone los datos semilla ficticios (solo prototipo).
// Útil para dejar la demo en su estado inicial antes de presentar.
export async function POST() {
  const result = await seedDemoData(db);
  return NextResponse.json({ ok: true, ...result });
}
