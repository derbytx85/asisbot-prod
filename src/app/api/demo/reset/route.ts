import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { seedDemoData } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

// POST /api/demo/reset — repone los datos semilla ficticios (solo prototipo).
// Seguridad: requiere DEMO_RESET_SECRET (header X-Demo-Secret o query ?secret=)
export async function POST(req: Request) {
  const secret = req.headers.get("X-Demo-Secret") ?? req.headers.get("x-demo-secret") ?? new URL(req.url).searchParams.get("secret");
  const expected = process.env.DEMO_RESET_SECRET ?? process.env.DEMO_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!expected && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "DEMO_RESET_SECRET no configurado en producción." },
      { status: 503 },
    );
  }
  const result = await seedDemoData(db);
  return NextResponse.json({ ok: true, ...result });
}
