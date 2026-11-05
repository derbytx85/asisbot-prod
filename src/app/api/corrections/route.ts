import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/corrections — historial de correcciones (mejora §2, auditoría).
// Quién corrigió, cuándo, valor anterior, valor nuevo y motivo.
export async function GET() {
  const corrections = await db.correction.findMany({
    include: {
      checkIn: {
        select: {
          id: true,
          type: true,
          timestamp: true,
          worker: { select: { id: true, name: true, avatarHue: true, position: true } },
        },
      },
    },
    orderBy: { correctedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ corrections });
}
