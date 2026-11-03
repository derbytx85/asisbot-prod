"use client";

// ─── AsisBot · shell de la aplicación ───────────────────────────────────────
// Prototipo demo: panel de RR.HH. + simulador WhatsApp en una sola SPA.
// Diseño según skill design-taste-frontend (variance 3 · motion 2 · density 7).

import { useState, useSyncExternalStore } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Bell,
  Building2,
  ClipboardCheck,
  FileText,
  MapPin,
  Menu,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/asisbot/Avatar";
import { PanelEnVivo } from "@/components/asisbot/PanelEnVivo";
import { SimuladorWhatsApp } from "@/components/asisbot/SimuladorWhatsApp";
import { ColaRevision } from "@/components/asisbot/ColaRevision";
import { AlertasView } from "@/components/asisbot/AlertasView";
import { TrabajadoresView } from "@/components/asisbot/TrabajadoresView";
import { ZonasView } from "@/components/asisbot/ZonasView";
import { ReportesView } from "@/components/asisbot/ReportesView";
import { MisMarcas } from "@/components/asisbot/MisMarcas";
import { MandantePortal } from "@/components/asisbot/MandantePortal";
import { getAlerts, getCheckins } from "@/components/asisbot/api";
import { PRIVACY_LINE } from "@/components/asisbot/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type ViewId =
  | "panel"
  | "simulador"
  | "mismarcas"
  | "revision"
  | "alertas"
  | "trabajadores"
  | "zonas"
  | "reportes"
  | "mandante";

const NAV: Array<{ id: ViewId; label: string; icon: typeof Activity; queue?: boolean }> = [
  { id: "panel", label: "Panel en vivo", icon: Activity },
  { id: "simulador", label: "Simulador WhatsApp", icon: MessageCircle },
  { id: "mismarcas", label: "Mis marcas", icon: BadgeCheck },
  { id: "revision", label: "Cola de revisión", icon: ClipboardCheck, queue: true },
  { id: "alertas", label: "Alertas", icon: Bell, queue: true },
  { id: "trabajadores", label: "Trabajadores", icon: Users },
  { id: "zonas", label: "Zonas", icon: MapPin },
  { id: "reportes", label: "Reportes", icon: FileText },
  { id: "mandante", label: "Reporte mandante", icon: Building2 },
];

const TITLES: Record<ViewId, { title: string; sub: string }> = {
  panel: { title: "Panel en vivo", sub: "Asistencia de hoy, en tiempo real" },
  simulador: { title: "Simulador WhatsApp", sub: "Así marca un trabajador: mensaje, ubicación y selfie" },
  mismarcas: { title: "Mis marcas", sub: "Tus marcaciones: fecha, hora, lugar y estado. Solo tú ves esto" },
  revision: { title: "Cola de revisión", sub: "La IA sugiere; la decisión final es humana y queda auditada" },
  alertas: { title: "Alertas", sub: "Detección automática de irregularidades para revisión humana" },
  trabajadores: { title: "Trabajadores", sub: "Alta, edición y desactivación de la dotación (datos ficticios)" },
  zonas: { title: "Zonas de trabajo", sub: "Geocercas autorizadas para validar ubicaciones" },
  reportes: { title: "Reportes", sub: "Jornadas por trabajador y día, exportables a CSV" },
  mandante: { title: "Reporte mandante", sub: "Vista pública de demostración, solo lectura" },
};

/** Parsea "#/vista?z=id" → { view, zoneId } (soporta deep-link del portal mandante). */
function parseHash(hash: string): { view: ViewId; zoneId?: string } {
  const h = hash.replace(/^#\/?/, "");
  const [path, query] = h.split("?");
  const known = NAV.find((n) => n.id === path)?.id;
  const view = (known ?? (path === "mandante" ? "mandante" : "panel")) as ViewId;
  const zoneId = query
    ? (new URLSearchParams(query).get("z") ?? undefined)
    : undefined;
  return { view, zoneId };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, retry: 1 } },
});

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AsisBotApp />
    </QueryClientProvider>
  );
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function AsisBotApp() {
  // vista sincronizada con el hash de la URL (deep-linking de la demo)
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
  const { view, zoneId } = parseHash(hash);
  const [menuOpen, setMenuOpen] = useState(false);

  function go(v: ViewId) {
    window.history.pushState(null, "", `#/${v}`);
    // dispara la actualización sin depender de hashchange (pushState no lo emite)
    dispatchEvent(new Event("hashchange"));
    setMenuOpen(false);
  }

  // contadores de las colas (solo donde hay acción pendiente, skill §3.2)
  const { data: revData } = useQuery({
    queryKey: ["checkins", "revision"],
    queryFn: () => getCheckins({ status: "EN_REVISION" }),
    refetchInterval: 20000,
  });
  const { data: alertData } = useQuery({
    queryKey: ["alerts", "shell"],
    queryFn: () => getAlerts({ status: "PENDIENTE" }),
    refetchInterval: 20000,
  });
  const revCount = (revData?.checkins ?? []).filter((c) => !c.reviewedBy).length;
  const alertCount = (alertData?.alerts ?? []).length;

  const counts: Partial<Record<ViewId, number>> = {
    revision: revCount,
    alertas: alertCount,
  };

  // Portal del mandante: página completa sin el shell interno (mejora §3).
  // Después de todos los hooks, para respetar las reglas de React.
  // La key fuerza remount cuando cambia la zona del deep-link (#mandante?z=).
  if (view === "mandante") {
    return <MandantePortal key={zoneId ?? "mandante"} initialZoneId={zoneId} />;
  }

  const nav = (
    <nav aria-label="Secciones" className="flex flex-col gap-0.5 px-2">
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = view === n.id;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => go(n.id)}
            aria-current={active ? "page" : undefined}
            className={`flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors ${
              active
                ? "bg-[var(--sidebar-accent)] font-medium text-foreground"
                : "text-[#4c544c] hover:bg-[#ecefee]"
            }`}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="flex-1 text-left">{n.label}</span>
            {n.queue && (counts[n.id] ?? 0) > 0 && (
              <span className="num rounded-full bg-[#c4242a] px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-white">
                {counts[n.id]}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-4 pb-1 pt-4">
      <Mark />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">AsisBot</p>
        <p className="text-[11.5px] text-muted-foreground">Demo Chile · datos ficticios</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* barra superior móvil */}
      <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-border bg-background px-3 lg:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menú"
              className="grid size-9 place-items-center rounded-md transition hover:bg-[#ecefee]"
            >
              <Menu className="size-4.5" aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-background p-0">
            <SheetHeader className="border-b border-border px-0 pb-2 pt-1">
              <SheetTitle asChild>
                <div className="text-left">{brand}</div>
              </SheetTitle>
            </SheetHeader>
            <div className="py-2">{nav}</div>
            <div className="absolute inset-x-0 bottom-0 border-t border-border p-3">
              <UserRow />
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Mark />
          <p className="text-[14.5px] font-semibold">AsisBot</p>
        </div>
        <span className="ml-auto text-[12px] text-muted-foreground">DEMO</span>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        {/* sidebar escritorio */}
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col justify-between border-r border-border lg:flex">
          <div>
            {brand}
            <div className="mt-3">{nav}</div>
          </div>
          <div className="border-t border-border p-3">
            <UserRow />
          </div>
        </aside>

        {/* canvas */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* aviso de demo (visible siempre, brief §5) */}
          <div className="border-b border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-4 py-1.5 text-[12px] leading-snug text-[var(--pill-warning-ink)] md:px-6">
            <strong className="font-semibold">Demo con datos ficticios.</strong> En producción,
            el uso requiere autorización de la empresa y del trabajador. La decisión final ante
            una inconsistencia siempre la revisa una persona autorizada.
          </div>

          <div className="flex-1 px-4 py-4 md:px-6 md:py-5">
            <div className="mx-auto w-full max-w-[1320px]">
              {/* título de la vista: sustantivo 24px + línea de hallazgo */}
              <ViewHeader view={view} />

              <div className="mt-4">
                {view === "panel" && <PanelEnVivo onVerRevision={() => go("revision")} />}
                {view === "simulador" && <SimuladorWhatsApp />}
                {view === "mismarcas" && <MisMarcas />}
                {view === "revision" && <ColaRevision />}
                {view === "alertas" && <AlertasView />}
                {view === "trabajadores" && <TrabajadoresView />}
                {view === "zonas" && <ZonasView />}
                {view === "reportes" && <ReportesView />}
              </div>
            </div>
          </div>

          {/* pie pegado al fondo del viewport (mt-auto vía flex-1 en contenido) */}
          <footer className="mt-auto border-t border-border bg-background">
            <div className="mx-auto w-full max-w-[1320px] px-4 py-2.5 text-[11.5px] leading-snug text-muted-foreground md:px-6">
              <p className="flex items-center gap-1.5 border-b border-[#eef0ee] pb-1.5">
                <ShieldCheck className="size-3 shrink-0 text-[var(--accent)]" aria-hidden />
                <span>
                  <strong className="font-medium text-foreground">Privacidad:</strong> {PRIVACY_LINE}
                </span>
              </p>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1.5">
                <p>
                  AsisBot · Prototipo demo — no almacena datos personales reales ni selfies reales.
                </p>
                <p>
                  Metas proyectadas: −70% de tiempo administrativo · trazabilidad &gt;95% (no son
                  resultados observados).
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function ViewHeader({ view }: { view: ViewId }) {
  const { title, sub } = TITLES[view];
  return (
    <header>
      <h1 className="text-[24px] font-semibold leading-tight tracking-tight">{title}</h1>
      <p className="mt-0.5 text-[14px] text-muted-foreground">{sub}</p>
    </header>
  );
}

function UserRow() {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name="M. Contreras" hue={210} size={30} />
      <div className="leading-tight">
        <p className="text-[13px] font-medium">M. Contreras</p>
        <p className="text-[11.5px] text-muted-foreground">RR.HH. · supervisora (demo)</p>
      </div>
    </div>
  );
}

/** Marca del producto: burbuja de chat con verificación (dibujada para AsisBot) */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0e7a47" />
      <path
        d="M16 6.5c-5.25 0-9.5 3.7-9.5 8.25 0 2.6 1.4 4.92 3.6 6.44v4.31l3.98-2.2c.62.11 1.27.17 1.92.17 5.25 0 9.5-3.7 9.5-8.25S21.25 6.5 16 6.5Z"
        fill="#fff"
      />
      <path
        d="m11.8 15.1 2.9 2.9 5.5-5.6"
        fill="none"
        stroke="#0e7a47"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
