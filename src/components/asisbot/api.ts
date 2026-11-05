import type { Alert, CheckIn, Correction, DashboardData, FpSummary, MandanteData, MonthlyRow, MonthlyWeekRow, ReportRow, Worker, Zone } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? `Error ${res.status}`);
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

export const getDashboard = () => request<DashboardData>("/api/dashboard");
export const getWorkers = () => request<{ workers: Worker[] }>("/api/workers");
export const createWorker = (body: Partial<Worker>) => request<{ worker: Worker }>("/api/workers", { method: "POST", body: JSON.stringify(body) });
export const updateWorker = (id: string, body: Partial<Worker>) => request<{ worker: Worker }>(`/api/workers/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const getZones = () => request<{ zones: Zone[] }>("/api/zones");
export const createZone = (body: { name: string; lat: number; lng: number; radiusM: number; address?: string }) => request<{ zone: Zone }>("/api/zones", { method: "POST", body: JSON.stringify(body) });

export const getCheckins = (params: { scope?: "today" | "all"; workerId?: string; status?: string; reviewed?: "1" }) => {
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
  result: { status: string; reason: string; similarity: number | null; distanceM: number | null; syncLateMin?: number | null };
}

export const markCheckin = (body: { workerId: string; type: "ENTRADA" | "SALIDA"; lat?: number | null; lng?: number | null; selfieKind?: "referencia" | "otra" | "galeria" | null; demoAt?: string | null; offline?: boolean }) =>
  request<MarkResult>("/api/checkins", { method: "POST", body: JSON.stringify(body) });

export const reviewCheckin = (id: string, body: { decision: "APROBADA" | "RECHAZADA"; note: string }) =>
  request<{ checkin: CheckIn }>(`/api/checkins/${id}/review`, { method: "POST", body: JSON.stringify(body) });

export const syncCheckin = (id: string) => request<MarkResult>(`/api/checkins/${id}/sync`, { method: "POST" });
export const addWorkerNote = (id: string, text: string) => request<{ checkin: CheckIn }>(`/api/checkins/${id}/note`, { method: "POST", body: JSON.stringify({ text }) });
export const correctCheckin = (id: string, body: { newTimestamp?: string | null; newStatus?: "APROBADA" | "RECHAZADA" | null; reason: string }) =>
  request<{ checkin: CheckIn; corrections: Correction[] }>(`/api/checkins/${id}/correct`, { method: "POST", body: JSON.stringify(body) });

export const getCorrections = () => request<{ corrections: Array<Correction & { checkIn: { id: string; type: CheckIn["type"]; timestamp: string; worker?: { id: string; name: string; avatarHue: number; position: string } } }> }>("/api/corrections");

export const getAlerts = (params: { status?: string; type?: string; scope?: "today" | "all" }) => {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.type) sp.set("type", params.type);
  if (params.scope) sp.set("scope", params.scope);
  return request<{ alerts: Alert[]; fpSummary?: FpSummary }>(`/api/alerts?${sp}`);
};

export const resolveAlert = (id: string, note?: string) => request<{ alert: Alert }>(`/api/alerts/${id}/resolve`, { method: "POST", body: JSON.stringify({ note }) });
export const getReports = (days: number) => request<{ days: number; generatedAt: string; rows: ReportRow[] }>(`/api/reports?days=${days}`);
export const getMonthlyReport = (month: string) => request<{ month: string; generatedAt: string; rows: MonthlyRow[]; weeks: MonthlyWeekRow[]; correctionsCount: number }>(`/api/reports/monthly?month=${month}`);
export function downloadMonthlyCsv(month: string) { window.open(`/api/reports/monthly?month=${month}&format=csv`, "_blank"); }
export const getMandante = (zoneId: string, day?: string) => { const sp = new URLSearchParams({ zoneId }); if (day) sp.set("day", day); return request<MandanteData>(`/api/mandante?${sp}`); };
export const acceptConsent = (workerId: string) => request<{ consent: { id: string; version: string; acceptedAt: string } }>("/api/consent", { method: "POST", body: JSON.stringify({ workerId }) });
export const resetDemo = () => request<{ ok: boolean }>("/api/demo/reset", { method: "POST" });
