"use client";

// ─── Zonas de trabajo (geocercas) ───────────────────────────────────────────
// Crear zonas con nombre, centro y radio. El mapa muestra todas las
// geocercas; al crear, un clic sobre el mapa fija el centro.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createZone, getZones } from "./api";
import MapView from "./MapViewClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Zone } from "./types";

export function ZonasView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["zones"], queryFn: getZones });
  const zones = data?.zones ?? [];

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    lat: "-33.4489",
    lng: "-70.6693",
    radiusM: 200,
  });

  async function save() {
    setBusy(true);
    try {
      await createZone({
        name: form.name,
        address: form.address,
        lat: Number(form.lat),
        lng: Number(form.lng),
        radiusM: Number(form.radiusM),
      });
      toast.success("Zona creada", { description: `${form.name} · radio ${form.radiusM} m` });
      setOpen(false);
      setForm({ name: "", address: "", lat: "-33.4489", lng: "-70.6693", radiusM: 200 });
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la zona.");
    } finally {
      setBusy(false);
    }
  }

  const mapZones: Zone[] = open
    ? [
        ...zones,
        {
          id: "nueva",
          name: form.name || "Nueva zona",
          lat: Number(form.lat) || 0,
          lng: Number(form.lng) || 0,
          radiusM: Number(form.radiusM) || 100,
          address: null,
        },
      ]
    : zones;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className="rounded-lg border border-border bg-card" aria-label="Lista de zonas">
        <header className="flex items-center justify-between px-4 pb-1 pt-3.5">
          <h2 className="text-[16px] font-semibold">
            Zonas <span className="num text-[13px] font-normal text-muted-foreground">({zones.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="size-3.5" aria-hidden />
            Nueva zona
          </button>
        </header>
        {isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 rounded-md bg-[#f1f3f1]" />
            ))}
          </div>
        ) : zones.length === 0 ? (
          <p className="m-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
            Aún no hay zonas. Crea la primera geocerca.
          </p>
        ) : (
          <ul className="divide-y divide-[#eef0ee]">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="size-2.5 shrink-0 rounded-full bg-[var(--accent)]/70" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium leading-tight">{z.name}</p>
                  <p className="truncate text-[12px] leading-tight text-muted-foreground">
                    {z.address ?? "sin dirección"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-[13px]">{z.radiusM} m</p>
                  <p className="text-[12px] text-muted-foreground">
                    {z._count?.workers ?? 0} trabajador{(z._count?.workers ?? 0) === 1 ? "" : "es"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="px-4 pb-3 pt-1 text-[12px] text-muted-foreground">
          Una marcación es “dentro de zona” cuando la ubicación compartida cae dentro del
          radio de la zona asignada al trabajador.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-3" aria-label="Mapa de zonas">
        <header className="px-1 pb-2 pt-1">
          <h2 className="text-[16px] font-semibold">Geocercas</h2>
        </header>
        <MapView
          zones={mapZones}
          points={[]}
          className="h-[420px]"
        />
      </section>

      {/* Diálogo nueva zona */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva zona de trabajo</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Define el centro (latitud/longitud) y el radio de la geocerca.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[13.5px] font-medium">
                Nombre <span className="text-[var(--destructive)]">*</span>
              </span>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Obra Mapocho"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13.5px] font-medium">Dirección de referencia</span>
              <input
                className={inputCls}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Ej: Calle 123, Santiago"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[13.5px] font-medium">Latitud</span>
                <input
                  className={inputCls}
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  inputMode="decimal"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13.5px] font-medium">Longitud</span>
                <input
                  className={inputCls}
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  inputMode="decimal"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between text-[13.5px] font-medium">
                Radio de la geocerca
                <span className="num text-[13px] font-semibold text-foreground">{form.radiusM} m</span>
              </span>
              <input
                type="range"
                min={50}
                max={1000}
                step={10}
                value={form.radiusM}
                onChange={(e) => setForm({ ...form, radiusM: Number(e.target.value) })}
                className="w-full accent-[var(--accent)]"
                aria-label="Radio en metros"
              />
              <span className="flex justify-between text-[11px] text-muted-foreground">
                <span>50 m</span>
                <span>1.000 m</span>
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-md border border-input bg-white px-3 text-[13.5px] font-medium transition hover:bg-[#f4f6f4]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || form.name.trim().length < 2 || !isFinite(Number(form.lat)) || !isFinite(Number(form.lng))}
              className="h-9 rounded-md bg-primary px-3 text-[13.5px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Creando…" : "Crear zona"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-md border border-input bg-white px-2.5 text-[13.5px] outline-none transition focus:border-[var(--accent)]/50";
