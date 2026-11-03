// ─── AsisBot · Datos semilla (100% ficticios) ───────────────────────────────
// Usado por prisma/seed.ts y por POST /api/demo/reset.
// Genera: 2 zonas, 8 trabajadores y 7 días de historial con casos normales
// y anomalías (fuera de zona, suplantación, duplicada, atraso), más el
// estado de HOY con la cola de revisión ya poblada para la demo.

import type { PrismaClient } from "@prisma/client";
import {
  formatDistance,
  formatMinutes,
  formatHHMM,
  haversineM,
  simulateSimilarity,
} from "@/lib/attendance";
import { chileDaysAgoAt, chileInstant, chileToday } from "@/lib/tz";

const REVIEWER = "M. Contreras · RR.HH.";
const CONSENT_VERSION = "v1-2026-10";

// Zonas (Santiago/Quilicura, coordenadas de ejemplo)
const Z1 = { name: "Obra Balmaceda", lat: -33.449, lng: -70.669, radiusM: 200, address: "Av. Balmaceda 1123, Santiago Centro" };
const Z2 = { name: "Bodega Central", lat: -33.3638, lng: -70.7396, radiusM: 250, address: "Ruta 5 Norte 16890, Quilicura" };

// Puntos demo cerca del centro de cada zona (offsets en grados ~ decenas de m)
const NEAR_Z1 = { lat: -33.4483, lng: -70.6681 }; // ~95 m del centro Z1
const NEAR_Z1_B = { lat: -33.4496, lng: -70.67 }; // ~75 m SO del centro Z1
const NEAR_Z2 = { lat: -33.3633, lng: -70.7388 }; // ~110 m del centro Z2
const NEAR_Z2_B = { lat: -33.3644, lng: -70.7403 }; // ~95 m del centro Z2
const PUNTO_LEJOS = { lat: -33.3641, lng: -70.7401 }; // Bodega Central (para "fuera de zona" desde Z1)

const ZMAP = { Z1: 0, Z2: 1 };

interface WorkerSpec {
  name: string;
  rut: string;
  position: string;
  phone: string;
  zone: keyof typeof ZMAP;
  scheduleStart: string;
  scheduleEnd: string;
  hue: number;
}

const WORKERS: WorkerSpec[] = [
  { name: "Carlos Medina Riquelme", rut: "99.888.101-2", position: "Maestro primera", phone: "+56 9 6123 4501", zone: "Z1", scheduleStart: "08:00", scheduleEnd: "18:00", hue: 145 },
  { name: "José Fuentes Cárdenas", rut: "99.888.102-0", position: "Jornal", phone: "+56 9 6123 4502", zone: "Z1", scheduleStart: "08:00", scheduleEnd: "18:00", hue: 25 },
  { name: "María González Salas", rut: "99.888.103-9", position: "Prevencionista de riesgos", phone: "+56 9 6123 4503", zone: "Z1", scheduleStart: "08:30", scheduleEnd: "17:30", hue: 330 },
  { name: "Pedro Rojas Muñoz", rut: "99.888.104-7", position: "Operador de grúa", phone: "+56 9 6123 4504", zone: "Z1", scheduleStart: "07:30", scheduleEnd: "17:00", hue: 210 },
  { name: "Luisa Herrera Pinto", rut: "99.888.105-5", position: "Bodeguera", phone: "+56 9 6123 4505", zone: "Z2", scheduleStart: "08:30", scheduleEnd: "18:00", hue: 280 },
  { name: "Miguel Soto Álvarez", rut: "99.888.106-3", position: "Guardia de seguridad", phone: "+56 9 6123 4506", zone: "Z2", scheduleStart: "06:00", scheduleEnd: "14:00", hue: 55 },
  { name: "Andrés Vidal Rojas", rut: "99.888.107-1", position: "Vendedor de terreno", phone: "+56 9 6123 4507", zone: "Z2", scheduleStart: "09:00", scheduleEnd: "18:00", hue: 0 },
  { name: "Daniela Muñoz Vera", rut: "99.888.108-0", position: "Técnica de mantenimiento", phone: "+56 9 6123 4508", zone: "Z1", scheduleStart: "08:00", scheduleEnd: "17:00", hue: 190 },
];

function distToZone(pt: { lat: number; lng: number }, z: typeof Z1) {
  return haversineM(pt.lat, pt.lng, z.lat, z.lng);
}

export async function seedDemoData(db: PrismaClient) {
  await db.correction.deleteMany();
  await db.consent.deleteMany();
  await db.alert.deleteMany();
  await db.checkIn.deleteMany();
  await db.worker.deleteMany();
  await db.zone.deleteMany();

  const z1 = await db.zone.create({ data: Z1 });
  const z2 = await db.zone.create({ data: Z2 });
  const zones = [z1, z2];

  const ws: Record<string, { id: string; spec: WorkerSpec }> = {};
  for (const spec of WORKERS) {
    const w = await db.worker.create({
      data: {
        name: spec.name,
        rut: spec.rut,
        position: spec.position,
        phone: spec.phone,
        zoneId: zones[ZMAP[spec.zone]].id,
        scheduleStart: spec.scheduleStart,
        scheduleEnd: spec.scheduleEnd,
        avatarHue: spec.hue,
      },
    });
    ws[spec.name] = { id: w.id, spec };
  }

  const w = (k: string) => ws[k];
  const zoneOf = (k: string) => zones[ZMAP[w(k).spec.zone]];

  // ── Consentimiento informado (mejora §1) ──────────────────────────────
  // Todos aceptaron hace 8 días, EXCEPTO Andrés Vidal Rojas: al seleccionarlo
  // en el simulador se demuestra el paso de consentimiento obligatorio.
  for (const spec of WORKERS) {
    if (spec.name === "Andrés Vidal Rojas") continue;
    await db.consent.create({
      data: {
        workerId: w(spec.name).id,
        version: CONSENT_VERSION,
        acceptedAt: chileDaysAgoAt(8, 9, 0),
      },
    });
  }

  type AlertSeed = {
    type: string;
    message: string;
    status: string;
    resolvedBy?: string;
    resolvedAt?: Date;
    resolutionNote?: string;
  };
  type CheckSeed = {
    workerKey: string;
    type: "ENTRADA" | "SALIDA";
    at: Date;
    pt: { lat: number; lng: number } | null;
    status: string;
    similarity?: number | null;
    selfieKind?: string | null;
    reason: string;
    alerts?: AlertSeed[];
    reviewedBy?: string;
    reviewedAt?: Date;
    reviewNote?: string;
    /** Marca sin señal aún en el teléfono (mejora §4). */
    pendingSync?: boolean;
    /** Explicación del trabajador (mejora §5). */
    workerNote?: string;
    /** Correcciones aplicadas a la marca original (mejora §2). */
    corrections?: Array<{
      field: "timestamp" | "status";
      oldValue: string;
      newValue: string;
      reason: string;
      correctedBy?: string;
      correctedAt?: Date;
    }>;
  };

  const days: CheckSeed[] = [];
  const push = (c: CheckSeed) => days.push(c);

  // ── Historial: 7 días anteriores, jornada normal para todos ─────────────
  for (let d = 1; d <= 7; d++) {
    const at = (hh: number, mm: number) => chileDaysAgoAt(d, hh, mm);
    for (const spec of WORKERS) {
      const key = spec.name;
      const isZ2 = spec.zone === "Z2";
      const pt = isZ2 ? NEAR_Z2 : NEAR_Z1;
      const z = zoneOf(key);
      const dist = distToZone(pt, z);
      const [sh, sm] = spec.scheduleStart.split(":").map(Number);
      const [eh, em] = spec.scheduleEnd.split(":").map(Number);
      const jitter = (d * 7) % 13;
      const eAt = at(sh, sm + (jitter % 9));
      const sAt = at(eh, em + (jitter % 7));
      const sim = simulateSimilarity(w(key).id, "referencia", eAt)!;
      push({
        workerKey: key, type: "ENTRADA", at: eAt, pt,
        status: "APROBADA", similarity: sim, selfieKind: "referencia",
        reason: `Marcación correcta: identidad verificada (${sim}%) · dentro de ${z.name} (a ${formatDistance(dist)}).`,
      });
      push({
        workerKey: key, type: "SALIDA", at: sAt, pt,
        status: "APROBADA", similarity: sim, selfieKind: "referencia",
        reason: `Jornada de ${formatMinutes(Math.max(0, Math.round((sAt.getTime() - eAt.getTime()) / 60000)))} (entrada ${formatHHMM(eAt)} — salida ${formatHHMM(sAt)}). Identidad verificada (${sim}%) · dentro de ${z.name} (a ${formatDistance(dist)}).`,
      });
    }
  }

  // D-4: José marca desde otra obra a las 08:47 → RR.HH. CORRIGE la hora a
  // 08:00 (registro manual en bitácora) y aprueba. La marca original queda
  // en el historial de correcciones (mejora §2).
  {
    const at = chileDaysAgoAt(4, 8, 47);
    const z = zoneOf("José Fuentes Cárdenas");
    const dist = distToZone(PUNTO_LEJOS, z);
    const sim = simulateSimilarity(w("José Fuentes Cárdenas").id, "referencia", at)!;
    const correctedAt = new Date(at.getTime() + 40 * 60000);
    const newAt = chileDaysAgoAt(4, 8, 0);
    push({
      workerKey: "José Fuentes Cárdenas", type: "ENTRADA", at: newAt, pt: NEAR_Z1,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Aprobada tras corrección: identidad verificada (${sim}%) · dentro de ${z.name}. Hora corregida de 08:47 a 08:00 según registro manual del jefe de terreno.`,
      alerts: [
        { type: "FUERA_ZONA", message: `Marcación a ${formatDistance(dist)} de ${z.name} (radio autorizado: ${z.radiusM} m).`, status: "RESUELTA", resolvedBy: REVIEWER, resolvedAt: correctedAt, resolutionNote: "Corregida: la marca llegó desde otra obra por falla del teléfono; hora ajustada según bitácora." },
        { type: "INCOHERENTE", message: `Ubicación incoherente: a ${formatDistance(dist)} de la marca anterior (salida del día previo).`, status: "RESUELTA", resolvedBy: REVIEWER, resolvedAt: correctedAt, resolutionNote: "Corregida junto con la hora según registro manual." },
      ],
      reviewedBy: REVIEWER, reviewedAt: correctedAt,
      reviewNote: "Corregida (hora 08:47→08:00): registro manual del jefe de terreno.",
      corrections: [
        { field: "timestamp", oldValue: "08:47", newValue: "08:00", reason: "Registro manual del jefe de terreno: el teléfono del trabajador marcó 08:47 pero ingresó a las 08:00.", correctedAt },
        { field: "status", oldValue: "EN_REVISION", newValue: "APROBADA", reason: "Corregida la hora; la asistencia de ese día quedó regularizada.", correctedAt },
      ],
    });
    const sAt = chileDaysAgoAt(4, 18, 3);
    push({
      workerKey: "José Fuentes Cárdenas", type: "SALIDA", at: sAt, pt: NEAR_Z1,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Jornada de ${formatMinutes(Math.max(0, Math.round((sAt.getTime() - newAt.getTime()) / 60000)))} (entrada ${formatHHMM(newAt)} — salida ${formatHHMM(sAt)}). Identidad verificada (${sim}%).`,
    });
  }

  // D-3: José llega tarde (atraso 24 min → aprobada con alerta resuelta)
  {
    const at = chileDaysAgoAt(3, 8, 24);
    const z = zoneOf("José Fuentes Cárdenas");
    const dist = distToZone(NEAR_Z1, z);
    const sim = simulateSimilarity(w("José Fuentes Cárdenas").id, "referencia", at)!;
    push({
      workerKey: "José Fuentes Cárdenas", type: "ENTRADA", at, pt: NEAR_Z1,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Marcación correcta: identidad verificada (${sim}%) · dentro de ${z.name} (a ${formatDistance(dist)}) · atraso de 24 min.`,
      alerts: [{ type: "ATRASO", message: `Entrada a las ${formatHHMM(at)}; horario asignado 08:00 (24 min de atraso).`, status: "RESUELTA", resolvedBy: REVIEWER, resolvedAt: new Date(at.getTime() + 90 * 60000), resolutionNote: "Atraso justificado: locomoción suspendida por manifestación." }],
    });
  }

  // D-5: Pedro marca desde otra obra (fuera de zona → supervisor APRUEBA)
  {
    const at = chileDaysAgoAt(5, 7, 36);
    const z = zoneOf("Pedro Rojas Muñoz");
    const dist = distToZone(PUNTO_LEJOS, z);
    const sim = simulateSimilarity(w("Pedro Rojas Muñoz").id, "referencia", at)!;
    push({
      workerKey: "Pedro Rojas Muñoz", type: "ENTRADA", at, pt: PUNTO_LEJOS,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Aprobada tras revisión: identidad verificada (${sim}%) · a ${formatDistance(dist)} de ${z.name}, fuera del radio de ${z.radiusM} m. El supervisor autorizó el traslado del día.`,
      alerts: [{ type: "FUERA_ZONA", message: `Marcación a ${formatDistance(dist)} de ${z.name} (radio autorizado: ${z.radiusM} m).`, status: "RESUELTA", resolvedBy: REVIEWER, resolvedAt: new Date(at.getTime() + 75 * 60000), resolutionNote: "Aprobada: ese día se le asignó apoyo en Bodega Central. Registrado en bitácora." }],
      reviewedBy: REVIEWER, reviewedAt: new Date(at.getTime() + 75 * 60000),
      reviewNote: "Aprobada: traslado autorizado a Bodega Central ese día.",
    });
    const sAt = chileDaysAgoAt(5, 17, 5);
    push({
      workerKey: "Pedro Rojas Muñoz", type: "SALIDA", at: sAt, pt: NEAR_Z1,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Jornada de ${formatMinutes(Math.max(0, Math.round((sAt.getTime() - at.getTime()) / 60000)))} (entrada ${formatHHMM(at)} — salida ${formatHHMM(sAt)}). Identidad verificada (${sim}%).`,
    });
  }

  // D-2: Luisa con selfie de otra persona (suplantación → RECHAZADA; re-marca 10:05)
  {
    const at = chileDaysAgoAt(2, 8, 41);
    const z = zoneOf("Luisa Herrera Pinto");
    const dist = distToZone(NEAR_Z2, z);
    const sim = 63;
    push({
      workerKey: "Luisa Herrera Pinto", type: "ENTRADA", at, pt: NEAR_Z2,
      status: "RECHAZADA", similarity: sim, selfieKind: "otra",
      reason: `Rechazada tras revisión: selfie con ${sim}% de similitud (posible suplantación) · dentro de ${z.name} (a ${formatDistance(dist)}). Se solicitó nueva marcación.`,
      alerts: [{ type: "SUPLANTACION", message: `Posible suplantación: la selfie tiene ${sim}% de similitud con la foto de referencia (umbral 75%).`, status: "RESUELTA", resolvedBy: REVIEWER, resolvedAt: new Date(at.getTime() + 50 * 60000), resolutionNote: "Rechazada: la selfie no corresponde a la trabajadora. Se solicitó nueva marcación." }],
      reviewedBy: REVIEWER, reviewedAt: new Date(at.getTime() + 50 * 60000),
      reviewNote: "Rechazada: selfie no corresponde a la trabajadora.",
    });
    const reAt = chileDaysAgoAt(2, 10, 5);
    const sim2 = simulateSimilarity(w("Luisa Herrera Pinto").id, "referencia", reAt)!;
    push({
      workerKey: "Luisa Herrera Pinto", type: "ENTRADA", at: reAt, pt: NEAR_Z2,
      status: "APROBADA", similarity: sim2, selfieKind: "referencia",
      reason: `Marcación correcta: identidad verificada (${sim2}%) · dentro de ${z.name} (a ${formatDistance(dist)}).`,
    });
    const sAt = chileDaysAgoAt(2, 18, 6);
    push({
      workerKey: "Luisa Herrera Pinto", type: "SALIDA", at: sAt, pt: NEAR_Z2,
      status: "APROBADA", similarity: sim2, selfieKind: "referencia",
      reason: `Jornada de ${formatMinutes(Math.max(0, Math.round((sAt.getTime() - reAt.getTime()) / 60000)))} (entrada ${formatHHMM(reAt)} — salida ${formatHHMM(sAt)}). Identidad verificada (${sim2}%).`,
    });
  }

  // D-1: Andrés envía la marcación dos veces (duplicada → rechazada)
  {
    const at = chileDaysAgoAt(1, 9, 2);
    const z = zoneOf("Andrés Vidal Rojas");
    const dist = distToZone(NEAR_Z2, z);
    const sim = simulateSimilarity(w("Andrés Vidal Rojas").id, "referencia", at)!;
    push({
      workerKey: "Andrés Vidal Rojas", type: "ENTRADA", at, pt: NEAR_Z2,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Marcación correcta: identidad verificada (${sim}%) · dentro de ${z.name} (a ${formatDistance(dist)}).`,
    });
    const dupAt = chileDaysAgoAt(1, 9, 4);
    push({
      workerKey: "Andrés Vidal Rojas", type: "ENTRADA", at: dupAt, pt: NEAR_Z2,
      status: "RECHAZADA", similarity: null, selfieKind: "referencia",
      reason: "Marcación duplicada: ya existía una entrada registrada hace 2 min. No se tomó una nueva marcación.",
      alerts: [{ type: "DUPLICADA", message: `Marcación duplicada: ya se registró entrada a las ${formatHHMM(at)} (hace 2 min).`, status: "RESUELTA", resolvedBy: REVIEWER, resolvedAt: new Date(dupAt.getTime() + 30 * 60000), resolutionNote: "Doble envío del trabajador; se mantiene la primera marcación." }],
    });
    const sAt = chileDaysAgoAt(1, 18, 8);
    push({
      workerKey: "Andrés Vidal Rojas", type: "SALIDA", at: sAt, pt: NEAR_Z2,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Jornada de ${formatMinutes(Math.max(0, Math.round((sAt.getTime() - at.getTime()) / 60000)))} (entrada ${formatHHMM(at)} — salida ${formatHHMM(sAt)}). Identidad verificada (${sim}%).`,
    });
  }

  // D-6: María envía foto de GALERÍA (no tomada en el momento) → alerta
  // FOTO_GALERIA; el supervisor confirma en terreno y aprueba (falso positivo
  // real para el contador de la mejora §5).
  {
    const at = chileDaysAgoAt(6, 8, 22);
    const z = zoneOf("María González Salas");
    const dist = distToZone(NEAR_Z1_B, z);
    const sim = simulateSimilarity(w("María González Salas").id, "galeria", at)!;
    push({
      workerKey: "María González Salas", type: "ENTRADA", at, pt: NEAR_Z1_B,
      status: "APROBADA", similarity: sim, selfieKind: "galeria",
      reason: `Aprobada tras revisión: foto enviada desde la galería (no tomada en el momento), similitud ${sim}%. El supervisor confirmó en terreno que la trabajadora estaba en la obra a esa hora.`,
      alerts: [{ type: "FOTO_GALERIA", message: `La foto no fue tomada en el momento (desde galería). Similitud ${sim}% con la referencia, pero un supervisor debe confirmar la marca.`, status: "RESUELTA", resolvedBy: REVIEWER, resolvedAt: new Date(at.getTime() + 55 * 60000), resolutionNote: "Aprobada: prevencionista confirmó presencia en terreno a las 08:22." }],
      reviewedBy: REVIEWER, reviewedAt: new Date(at.getTime() + 55 * 60000),
      reviewNote: "Aprobada: presencia confirmada en terreno; se pide usar selfie en el momento.",
    });
    const sAt = chileDaysAgoAt(6, 17, 28);
    push({
      workerKey: "María González Salas", type: "SALIDA", at: sAt, pt: NEAR_Z1_B,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Jornada de ${formatMinutes(Math.max(0, Math.round((sAt.getTime() - at.getTime()) / 60000)))} (entrada ${formatHHMM(at)} — salida ${formatHHMM(sAt)}). Identidad verificada (${sim}%).`,
    });
  }

  // ── HOY: estado mixto para la demo ──────────────────────────────────────
  const t = chileToday();
  const hoy = (hh: number, mm: number) => chileInstant(t.year, t.month, t.day, hh, mm);

  for (const [key, hhmm, pt] of [
    ["Carlos Medina Riquelme", [8, 2], NEAR_Z1],
    ["María González Salas", [8, 31], NEAR_Z1_B],
    ["Pedro Rojas Muñoz", [7, 32], NEAR_Z1],
    ["Luisa Herrera Pinto", [8, 35], NEAR_Z2],
  ] as const) {
    const z = zoneOf(key);
    const dist = distToZone(pt, z);
    const at = hoy(hhmm[0], hhmm[1]);
    const sim = simulateSimilarity(w(key).id, "referencia", at)!;
    push({
      workerKey: key, type: "ENTRADA", at, pt,
      status: "APROBADA", similarity: sim, selfieKind: "referencia",
      reason: `Marcación correcta: identidad verificada (${sim}%) · dentro de ${z.name} (a ${formatDistance(dist)}).`,
    });
  }

  // Guardia: ya terminó jornada
  {
    const eAt = hoy(6, 1);
    const sAt = hoy(14, 2);
    const z = zoneOf("Miguel Soto Álvarez");
    const dist = distToZone(NEAR_Z2_B, z);
    const sim = simulateSimilarity(w("Miguel Soto Álvarez").id, "referencia", eAt)!;
    push({ workerKey: "Miguel Soto Álvarez", type: "ENTRADA", at: eAt, pt: NEAR_Z2_B, status: "APROBADA", similarity: sim, selfieKind: "referencia", reason: `Marcación correcta: identidad verificada (${sim}%) · dentro de ${z.name} (a ${formatDistance(dist)}).` });
    push({ workerKey: "Miguel Soto Álvarez", type: "SALIDA", at: sAt, pt: NEAR_Z2_B, status: "APROBADA", similarity: sim, selfieKind: "referencia", reason: `Jornada de ${formatMinutes(Math.max(0, Math.round((sAt.getTime() - eAt.getTime()) / 60000)))} (entrada ${formatHHMM(eAt)} — salida ${formatHHMM(sAt)}). Identidad verificada (${sim}%) · dentro de ${z.name} (a ${formatDistance(dist)}).` });
  }

  // Caso en revisión 1: José fuera de zona (marca desde Bodega Central)
  // Con la explicación que el trabajador dejó desde el simulador (mejora §5).
  {
    const at = hoy(8, 47);
    const z = zoneOf("José Fuentes Cárdenas");
    const dist = distToZone(PUNTO_LEJOS, z);
    const sim = simulateSimilarity(w("José Fuentes Cárdenas").id, "referencia", at)!;
    push({
      workerKey: "José Fuentes Cárdenas", type: "ENTRADA", at, pt: PUNTO_LEJOS,
      status: "EN_REVISION", similarity: sim, selfieKind: "referencia",
      reason: `En revisión: identidad verificada (${sim}%) · a ${formatDistance(dist)} de ${z.name}, fuera del radio de ${z.radiusM} m. Un supervisor debe revisar esta marcación.`,
      alerts: [{ type: "FUERA_ZONA", message: `Marcación a ${formatDistance(dist)} de ${z.name} (radio autorizado: ${z.radiusM} m).`, status: "PENDIENTE" }],
      workerNote: "Estoy en el acceso 2 del lado oriente; el portón principal está cerrado por la obra.",
    });
  }

  // Caso en revisión 2: Andrés con selfie de otra persona
  {
    const at = hoy(9, 12);
    const z = zoneOf("Andrés Vidal Rojas");
    const dist = distToZone(NEAR_Z2_B, z);
    const sim = 61;
    push({
      workerKey: "Andrés Vidal Rojas", type: "ENTRADA", at, pt: NEAR_Z2_B,
      status: "EN_REVISION", similarity: sim, selfieKind: "otra",
      reason: `En revisión: selfie con ${sim}% de similitud (posible suplantación) · dentro de ${z.name} (a ${formatDistance(dist)}). Un supervisor debe revisar esta marcación.`,
      alerts: [{ type: "SUPLANTACION", message: `Posible suplantación: la selfie tiene ${sim}% de similitud con la foto de referencia (umbral 75%).`, status: "PENDIENTE" }],
    });
  }

  // Marca sin señal (mejora §4): Daniela marcó entrada 07:58 sin cobertura;
  // sigue guardada en su teléfono esperando sincronización (hora original
  // intacta). Al sincronizar en el simulador pasará a la cola de revisión
  // como sincronización tardía.
  {
    const at = hoy(7, 58);
    const z = zoneOf("Daniela Muñoz Vera");
    push({
      workerKey: "Daniela Muñoz Vera", type: "ENTRADA", at, pt: NEAR_Z1,
      status: "PENDIENTE_SYNC", similarity: null, selfieKind: "referencia",
      reason: `Guardada en el teléfono sin señal a las ${formatHHMM(at)}. Se enviará cuando vuelva la cobertura; conserva su hora original.`,
      pendingSync: true,
    });
  }

  // ── Insertar todo ────────────────────────────────────────────────────────
  days.sort((a, b) => a.at.getTime() - b.at.getTime());
  let n = 0;
  for (const c of days) {
    const { id: workerId } = w(c.workerKey);
    const check = await db.checkIn.create({
      data: {
        workerId,
        type: c.type,
        timestamp: c.at,
        lat: c.pt?.lat ?? null,
        lng: c.pt?.lng ?? null,
        distanceM: c.pt && c.status !== "RECHAZADA" ? distToZone(c.pt, zoneOf(c.workerKey)) : null,
        status: c.status,
        similarity: c.similarity ?? null,
        selfieKind: c.selfieKind ?? null,
        reason: c.reason,
        reviewedBy: c.reviewedBy ?? null,
        reviewedAt: c.reviewedAt ?? null,
        reviewNote: c.reviewNote ?? null,
        pendingSync: c.pendingSync ?? false,
        workerNote: c.workerNote ?? null,
      },
    });
    for (const a of c.alerts ?? []) {
      await db.alert.create({
        data: {
          checkInId: check.id,
          type: a.type,
          message: a.message,
          status: a.status,
          resolvedBy: a.resolvedBy ?? null,
          resolvedAt: a.resolvedAt ?? null,
          resolutionNote: a.resolutionNote ?? null,
          createdAt: c.at,
        },
      });
    }
    for (const corr of c.corrections ?? []) {
      await db.correction.create({
        data: {
          checkInId: check.id,
          field: corr.field,
          oldValue: corr.oldValue,
          newValue: corr.newValue,
          reason: corr.reason,
          correctedBy: corr.correctedBy ?? REVIEWER,
          correctedAt: corr.correctedAt ?? c.at,
        },
      });
    }
    n++;
  }
  return { checkins: n, workers: WORKERS.length, zones: zones.length, consents: WORKERS.length - 1 };
}
