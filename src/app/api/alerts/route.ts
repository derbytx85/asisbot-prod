import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chileInstant, chileToday } from "@/lib/tz";

export const dynamic = "force-dynamic";

// GET /api/alerts?status=&type=&scope=today|all
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "today";
  const status = sp.get("status");
  const type = sp.get("type");

  const where: Record<string, unknown> = {};
  if (scope === "today") {
    const t = chileToday();
    where.createdAt = {
      gte: chileInstant(t.year, t.month, t.day, 0, 0),
      lt: chileInstant(t.year, t.month, t.day + 1, 0, 0),
    };
  }
  if (status) where.status = status;
  if (type) where.type = type;

  const alerts = await db.alert.findMany({
    where,
    include: {
      checkIn: {
        include: {
          worker: {
            select: { id: true, name: true, avatarHue: true, position: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Mejora §5: contador REAL de falsos positivos (alerta de anomalía que
  // terminó en marcación aprobada). ATRASO se excluye: es informativo, un
  // atraso aprobado no invalida la detección. Se calcula de los datos, no se
  // inventa; la meta del piloto es <20% en la semana 4 (proyectado).
  const resolved = await db.alert.findMany({
    where: { status: "RESUELTA", type: { not: "ATRASO" } },
    include: { checkIn: { select: { status: true } } },
  });
  const falsePositives = resolved.filter((a) => a.checkIn.status === "APROBADA").length;
  const fpSummary = {
    resolved: resolved.length,
    falsePositives,
    ratePct: resolved.length > 0 ? Math.round((falsePositives / resolved.length) * 100) : 0,
  };

  return NextResponse.json({ alerts, fpSummary });
}
