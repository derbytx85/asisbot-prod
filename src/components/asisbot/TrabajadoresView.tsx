"use client";

// ─── Trabajadores ───────────────────────────────────────────────────────────
// Crear, editar y desactivar (nombre, cargo, zona, horario, foto de
// referencia de demo). Administrador demo.

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Power } from "lucide-react";
import { createWorker, getWorkers, updateWorker } from "./api";
import { Avatar } from "./Avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Worker } from "./types";

interface FormState {
  name: string;
  rut: string;
  position: string;
  phone: string;
  zoneId: string;
  scheduleStart: string;
  scheduleEnd: string;
}

const EMPTY: FormState = {
  name: "",
  rut: "",
  position: "",
  phone: "+56 9 ",
  zoneId: "",
  scheduleStart: "08:00",
  scheduleEnd: "17:00",
};

export function TrabajadoresView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: zonesData } = useQuery({ queryKey: ["zones"], queryFn: async () => (await fetch("/api/zones")).json() });
  const zones = (zonesData?.zones ?? []) as Array<{ id: string; name: string }>;

  const [editing, setEditing] = useState<Worker | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  const workers = useMemo(() => data?.workers ?? [], [data]);
  const open = creating || !!editing;

  function openCreate() {
    setForm(EMPTY);
    setCreating(true);
  }
  function openEdit(w: Worker) {
    setEditing(w);
    setForm({
      name: w.name,
      rut: w.rut,
      position: w.position,
      phone: w.phone,
      zoneId: w.zoneId ?? "",
      scheduleStart: w.scheduleStart,
      scheduleEnd: w.scheduleEnd,
    });
  }

  async function save() {
    setBusy(true);
    try {
      if (editing) {
        await updateWorker(editing.id, form);
        toast.success("Trabajador actualizado");
      } else {
        await createWorker(form);
        toast.success("Trabajador creado");
      }
      setCreating(false);
      setEditing(null);
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(w: Worker) {
    try {
      await updateWorker(w.id, { active: !w.active });
      toast.success(w.active ? "Trabajador desactivado" : "Trabajador reactivado");
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cambiar estado.");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card" aria-label="Lista de trabajadores">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3.5">
          <h2 className="text-[16px] font-semibold">
            Trabajadores <span className="num text-[13px] font-normal text-muted-foreground">({workers.filter((w) => w.active).length} activos)</span>
          </h2>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="size-3.5" aria-hidden />
            Nuevo trabajador
          </button>
        </header>

        {isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-md bg-[#f1f3f1]" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-[#eef0ee]">
            {workers.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar name={w.name} hue={w.avatarHue} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium leading-tight">
                    {w.name}{" "}
                    {!w.active && <span className="pill pill-neutral ml-1">Desactivado</span>}
                  </p>
                  <p className="truncate text-[12px] leading-tight text-muted-foreground">
                    {w.position} · {w.rut} · {w.phone}
                  </p>
                </div>
                <div className="w-36 text-[13px]">
                  <p className="truncate">{w.zone?.name ?? <span className="text-muted-foreground">sin zona</span>}</p>
                  <p className="num text-[12px] text-muted-foreground">
                    {w.scheduleStart}–{w.scheduleEnd}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(w)}
                    aria-label={`Editar a ${w.name}`}
                    className="grid size-8 place-items-center rounded-md border border-input bg-white transition hover:bg-[#f4f6f4]"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(w)}
                    aria-label={w.active ? `Desactivar a ${w.name}` : `Reactivar a ${w.name}`}
                    className={`grid size-8 place-items-center rounded-md border border-input bg-white transition hover:bg-[#f4f6f4] ${
                      w.active ? "" : "text-[var(--accent)]"
                    }`}
                  >
                    <Power className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="px-4 pb-3 pt-1 text-[12px] text-muted-foreground">
          La “foto de referencia” para la verificación se simula en el prototipo con las
          selfies ilustradas de la demo; no se almacenan datos biométricos reales.
        </p>
      </section>

      {/* Dialogo crear/editar */}
      <Dialog open={open} onOpenChange={(o) => (!o ? (setCreating(false), setEditing(null)) : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar trabajador" : "Nuevo trabajador"}</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Datos de la demo: usa valores ficticios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre completo" required>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Ana Soto Pérez"
              />
            </Field>
            <Field label="RUT (ficticio)">
              <input
                className={inputCls}
                value={form.rut}
                onChange={(e) => setForm({ ...form, rut: e.target.value })}
                placeholder="99.888.000-K"
              />
            </Field>
            <Field label="Cargo" required>
              <input
                className={inputCls}
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="Ej: Jornal"
              />
            </Field>
            <Field label="Teléfono (WhatsApp)" required>
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+56 9 6123 4500"
              />
            </Field>
            <Field label="Zona asignada">
              <select
                className={inputCls}
                value={form.zoneId}
                onChange={(e) => setForm({ ...form, zoneId: e.target.value })}
              >
                <option value="">Sin zona</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Entrada">
                <input
                  type="time"
                  className={inputCls}
                  value={form.scheduleStart}
                  onChange={(e) => setForm({ ...form, scheduleStart: e.target.value })}
                />
              </Field>
              <Field label="Salida">
                <input
                  type="time"
                  className={inputCls}
                  value={form.scheduleEnd}
                  onChange={(e) => setForm({ ...form, scheduleEnd: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="h-9 rounded-md border border-input bg-white px-3 text-[13.5px] font-medium transition hover:bg-[#f4f6f4]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || form.name.trim().length < 3 || form.position.trim().length < 2}
              className="h-9 rounded-md bg-primary px-3 text-[13.5px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-md border border-input bg-white px-2.5 text-[13.5px] outline-none transition focus:border-[var(--accent)]/50";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-medium">
        {label}
        {required && <span className="text-[var(--destructive)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
