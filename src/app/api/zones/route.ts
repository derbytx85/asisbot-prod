import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: zones, error } = await supabase.from("Zone").select("*").order("createdAt");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const { name, lat, lng, radiusM, address } = body;
  if (!name?.trim()) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  const latN = Number(lat), lngN = Number(lng), rN = Number(radiusM);
  if (!Number.isFinite(latN) || latN < -90 || latN > 90)
    return NextResponse.json({ error: "Latitud inválida." }, { status: 400 });
  if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180)
    return NextResponse.json({ error: "Longitud inválida." }, { status: 400 });
  if (!Number.isInteger(rN) || rN < 50 || rN > 5000)
    return NextResponse.json({ error: "El radio debe ser un entero entre 50 y 5.000 m." }, { status: 400 });
  const { data: zone, error } = await supabase
    .from("Zone")
    .insert({ name: String(name).trim(), lat: latN, lng: lngN, radiusM: rN, address: address ? String(address).trim() : null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone }, { status: 201 });
}
