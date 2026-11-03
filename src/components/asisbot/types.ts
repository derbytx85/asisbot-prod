// Tipos compartidos con la API de AsisBot (fechas como strings ISO)

export type CheckType = "ENTRADA" | "SALIDA";
export type CheckStatus = "APROBADA" | "EN_REVISION" | "RECHAZADA" | "PENDIENTE_SYNC";
export type AlertType =
  | "FUERA_ZONA"
  | "SUPLANTACION"
  | "DUPLICADA"
  | "ATRASO"
  | "SIN_UBICACION"
  | "SIN_ENTRADA"
  | "SIN_SELFIE"
  | "FOTO_GALERIA"
  | "INCOHERENTE"
  | "SYNC_TARDE";
export type AlertStatus = "PENDIENTE" | "RESUELTA";
export type WorkerStatus =
  | "PRESENTE"
  | "AUSENTE"
  | "EN_REVISION"
  | "FUERA_ZONA"
  | "JORNADA_TERMINADA";

export interface Zone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  address: string | null;
  _count?: { workers: number };
}

export interface Worker {
  id: string;
  name: string;
  rut: string;
  position: string;
  phone: string;
  zoneId: string | null;
  zone?: Zone | null;
  scheduleStart: string;
  scheduleEnd: string;
  avatarHue: number;
  active: boolean;
  /** Consentimiento informado más reciente (mejora §1). */
  consent?: { version: string; acceptedAt: string } | null;
}

export interface Correction {
  id: string;
  checkInId: string;
  field: "timestamp" | "status";
  oldValue: string;
  newValue: string;
  reason: string;
  correctedBy: string;
  correctedAt: string;
}

export interface Alert {
  id: string;
  checkInId: string;
  type: AlertType;
  message: string;
  status: AlertStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  checkIn?: CheckIn & { worker?: WorkerRef };
}

export interface WorkerRef {
  id: string;
  name: string;
  avatarHue: number;
  position: string;
}

export interface CheckIn {
  id: string;
  workerId: string;
  type: CheckType;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  distanceM: number | null;
  status: CheckStatus;
  similarity: number | null;
  selfieKind: string | null;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** Marca sin señal: guardada en el teléfono, aún no llega al sistema. */
  pendingSync?: boolean;
  /** Hora de sincronización; null = llegó en línea. */
  syncAt?: string | null;
  /** Explicación del trabajador en una marca en revisión (mejora §5). */
  workerNote?: string | null;
  worker?: WorkerRef;
  alerts?: Alert[];
  corrections?: Correction[];
}

export interface DashboardWorkerRow {
  id: string;
  name: string;
  position: string;
  avatarHue: number;
  phone: string;
  zoneName: string | null;
  zoneId: string | null;
  scheduleStart: string;
  scheduleEnd: string;
  status: WorkerStatus;
  entrada: string | null;
  entradaStatus: CheckStatus | null;
  entradaSimilarity: number | null;
  salida: string | null;
  lastPoint: { lat: number; lng: number } | null;
  checkinsToday: number;
  pendingAlertTypes: string[];
  /** Tipos de marcas guardadas en el teléfono esperando señal (mejora §4). */
  pendingSyncTypes?: string[];
}

export interface DashboardData {
  generatedAt: string;
  chileDayKey: string;
  kpis: {
    dotacion: number;
    presentes: number;
    enRevision: number;
    jornadaTerminada: number;
    ausentes: number;
    alertasPendientes: number;
    marcacionesHoy: number;
    /** Marcas guardadas en teléfonos esperando señal (mejora §4). */
    pendientesSync: number;
  };
  workers: DashboardWorkerRow[];
  zones: Zone[];
  todayCheckins: Array<{
    id: string;
    workerId: string;
    type: CheckType;
    timestamp: string;
    lat: number | null;
    lng: number | null;
    status: CheckStatus;
    similarity: number | null;
    pendingSync?: boolean;
  }>;
}

export interface ReportRow {
  date: string;
  workerId: string;
  workerName: string;
  position: string;
  entrada: string | null;
  salida: string | null;
  workedMin: number | null;
  lateMin: number;
  alertsCount: number;
  pendingAlerts: number;
}

// ─── Mejoras de mercado ─────────────────────────────────────────────────────

/** Fila del reporte mensual para el contador (mejora §2). */
export interface MonthlyRow {
  date: string;
  workerId: string;
  workerName: string;
  position: string;
  zoneName: string | null;
  entrada: string | null;
  salida: string | null;
  workedMin: number | null;
  lateMin: number;
  correctionsCount: number;
  correctionsDetail: string;
}

/** Resumen semanal por trabajador (jornada 42 h, referencia Chile 2026). */
export interface MonthlyWeekRow {
  workerId: string;
  workerName: string;
  weekStart: string; // lunes de esa semana (YYYY-MM-DD)
  workedMin: number;
  exceeds42: boolean;
}

/** Resumen de falsos positivos de alertas (mejora §5, contador real). */
export interface FpSummary {
  resolved: number;
  falsePositives: number;
  ratePct: number;
}

/** Datos del portal del mandante (mejora §3, solo lectura, sin datos sensibles). */
export interface MandanteData {
  generatedAt: string;
  day: string;
  zone: { id: string; name: string; address: string | null };
  summary: { esperados: number; presentes: number; ausentes: number; atrasos: number };
  workers: Array<{
    id: string;
    name: string;
    position: string;
    scheduleStart: string;
    scheduleEnd: string;
    estado: "PRESENTE" | "AUSENTE" | "EN_REVISION" | "JORNADA_TERMINADA" | "PENDIENTE_SYNC";
    entrada: string | null;
    salida: string | null;
    lateMin: number;
    evidencia: Array<{
      type: CheckType;
      timestamp: string;
      status: CheckStatus;
      distanceM: number | null;
      similarity: number | null;
      latApprox: number | null;
      lngApprox: number | null;
      syncAt: string | null;
    }>;
  }>;
}

// ─── Etiquetas en español ───────────────────────────────────────────────────

export const STATUS_LABEL: Record<string, string> = {
  APROBADA: "Aprobada",
  EN_REVISION: "En revisión",
  RECHAZADA: "Rechazada",
  PENDIENTE_SYNC: "Por sincronizar",
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  FUERA_ZONA: "Fuera de zona",
  JORNADA_TERMINADA: "Jornada terminada",
  PENDIENTE: "Pendiente",
  RESUELTA: "Resuelta",
};

export const ALERT_LABEL: Record<string, string> = {
  FUERA_ZONA: "Fuera de zona",
  SUPLANTACION: "Posible suplantación",
  DUPLICADA: "Marcación duplicada",
  ATRASO: "Atraso",
  SIN_UBICACION: "Sin ubicación",
  SIN_ENTRADA: "Salida sin entrada",
  SIN_SELFIE: "Sin selfie",
  FOTO_GALERIA: "Foto de galería",
  INCOHERENTE: "Ubicación incoherente",
  SYNC_TARDE: "Sincronización tardía",
};

export const SELFIE_KIND_LABEL: Record<string, string> = {
  referencia: "Selfie tomada en el momento",
  otra: "Selfie de otra persona",
  galeria: "Foto desde la galería",
};

/** Clase de píldora por estado (paleta pálida del skill). */
export function statusPillClass(status: string): string {
  switch (status) {
    case "APROBADA":
    case "PRESENTE":
    case "RESUELTA":
      return "pill pill-positive";
    case "RECHAZADA":
    case "FUERA_ZONA":
      return "pill pill-negative";
    case "EN_REVISION":
    case "PENDIENTE":
      return "pill pill-warning";
    case "PENDIENTE_SYNC":
      return "pill pill-neutral";
    default:
      return "pill pill-neutral";
  }
}

/** Mensaje de privacidad del producto (mejora §1, siempre visible). */
export const PRIVACY_LINE =
  "Solo se registra ubicación en el momento de la marca, dentro de la jornada. Fuera de jornada, no hay registro.";
