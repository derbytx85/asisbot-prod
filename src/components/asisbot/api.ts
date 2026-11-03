// Cliente de la API simulada. Los endpoints están definidos para poder
// reemplazarlos después por un backend real (o Supabase) sin tocar la UI.

import type {
  Alert,
  CheckIn,
  Correction,
  DashboardData,
  FpSummary,
  MandanteData,
  MonthlyRow,
  MonthlyWeekRow,
  ReportRow,
  Worker,
  Zone,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? `Error ${res.status}`);
  }
  return json as T;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
export const getDashboard = () =>
  request<DashboardData>("/api/dashboard");

// ─── Trabajadores ───────────────────────────────────────────────────────────
export const getWorkers = () =>
  request<{ workers: Worker[] }>("/api/workers");

export const createWorker = (body: Partial<Worker>) =>
  request<{ worker: Worker }>("/api/workers", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateWorker = (id: string, body: Partial<Worker>) =>
  request<{ worker: Worker }>(`/api/workers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

// ─── Zonas ──────────────────────────────────────────────────────────────────
export const getZones = () => request<{ zones: Zone[] }>("/api/zones");

export const createZone = (body: {
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  address?: string;
}) => request<{ zone: Zone }>("/api/zones", { method: "POST", body: JSON.stringify(body) });

// ─── Marcaciones ────────────────────────────────────────────────────────────
export const getCheckins = (params: {
  scope?: "today" | "all";
  workerId?: string;
  status?: string;
  reviewed?: "1";
}) => {
  const sp = new URLSearchParams();
  if (params.scope) sp.set("scope", params.scope);
  if (params.workerId) sp.set("workerId", params.workerId);
  if (params.status) sp.set("status", params.status);
  if (params.reviewed) sp.set("reviewed", params.reviewed);
  return request<{ checkins: CheckIn[] }>(`/api/checkins?${sp}`);
};

export interface MarkResult {
  checkin: CheckIn;
  alerts: Alert[];
  result: {
    status: string;
    reason: string;
    similarity: number | null;
    distanceM: number | null;
    /** Minutos de atraso en la sincronización (marca sin señal). */
    syncLateMin?: number | null;
  };
}

export const markCheckin = (body: {
  workerId: string;
  type: "ENTRADA" | "SALIDA";
  lat?: number | null;
  lng?: number | null;
  selfieKind?: "referencia" | "otra" | "galeria" | null;
  /** Solo demo: hora simulada para casos reproducibles */
  demoAt?: string | null;
  /** Marca tolerante a mala señal: queda pendiente en el teléfono (mejora §4) */
  offline?: boolean;
}) =>
  request<MarkResult>("/api/checkins", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const reviewCheckin = (
  id: string,
  body: { decision: "APROBADA" | "RECHAZADA"; note: string },
) =>
  request<{ checkin: CheckIn }>(`/api/checkins/${id}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Sincroniza una marca pendiente (sin señal) con su hora original (mejora §4). */
export const syncCheckin = (id: string) =>
  request<MarkResult>(`/api/checkins/${id}/sync`, { method: "POST" });

/** Explicación del trabajador en una marca en revisión (mejora §5). */
export const addWorkerNote = (id: string, text: string) =>
  request<{ checkin: CheckIn }>(`/api/checkins/${id}/note`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

/** Corrección desde el panel con motivo obligatorio y auditoría (mejora §2). */
export const correctCheckin = (
  id: string,
  body: {
    newTimestamp?: string | null; // ISO
    newStatus?: "APROBADA" | "RECHAZADA" | null;
    reason: string;
  },
) =>
  request<{ checkin: CheckIn; corrections: Correction[] }>(
    `/api/checkins/${id}/correct`,
    { method: "POST", body: JSON.stringify(body) },
  );

/** Historial de correcciones para la auditoría (mejora §2). */
export const getCorrections = () =>
  request<{
    corrections: Array<
      Correction & {
        checkIn: {
          id: string;
          type: CheckIn["type"];
          timestamp: string;
          worker?: { id: string; name: string; avatarHue: number; position: string };
        };
      }
    >;
  }>("/api/corrections");

// ─── Alertas ────────────────────────────────────────────────────────────────
export const getAlerts = (params: {
  status?: string;
  type?: string;
  scope?: "today" | "all";
}) => {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.type) sp.set("type", params.type);
  if (params.scope) sp.set("scope", params.scope);
  return request<{
    alerts: Alert[];
    /** Contador real de falsos positivos (mejora §5: la IA alerta, no sanciona). */
    fpSummary?: FpSummary;
  }>(`/api/alerts?${sp}`);
};

export const resolveAlert = (id: string, note?: string) =>
  request<{ alert: Alert }>(`/api/alerts/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

// ─── Reportes ───────────────────────────────────────────────────────────────
export const getReports = (days: number) =>
  request<{ days: number; generatedAt: string; rows: ReportRow[] }>(
    `/api/reports?days=${days}`,
  );

/** Reporte mensual para el contador (mejora §2): horas, atrasos y correcciones. */
export const getMonthlyReport = (month: string) =>
  request<{
    month: string;
    generatedAt: string;
    rows: MonthlyRow[];
    weeks: MonthlyWeekRow[];
    correctionsCount: number;
  }>(`/api/reports/monthly?month=${month}`);

/** Descarga el CSV del reporte mensual (BOM UTF-8 + ';' para Excel es-CL). */
export function downloadMonthlyCsv(month: string) {
  window.open(`/api/reports/monthly?month=${month}&format=csv`, "_blank");
}

// ─── Portal del mandante (mejora §3, solo lectura) ─────────────────────
export const getMandante = (zoneId: string, day?: string) => {
  const sp = new URLSearchParams({ zoneId });
  if (day) sp.set("day", day);
  return request<MandanteData>(`/api/mandante?${sp}`);
};

// ─── Consentimiento (mejora §1) ─────────────────────────────────────────
export const acceptConsent = (workerId: string) =>
  request<{ consent: { id: string; version: string; acceptedAt: string } }>(
    "/api/consent",
    { method: "POST", body: JSON.stringify({ workerId }) },
  );

// ─── Demo ───────────────────────────────────────────────────────────────────
export const resetDemo = () =>
  request<{ ok: boolean }>("/api/demo/reset", { method: "POST" });
