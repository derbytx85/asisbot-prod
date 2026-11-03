"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapViewClientTypes";

// Leaflet requiere window: se carga solo en el cliente.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center rounded-lg border border-border bg-[#e8ecea]"
      aria-label="Cargando mapa"
      role="status"
    >
      <p className="text-[12.5px] text-muted-foreground">Cargando mapa…</p>
    </div>
  ),
});

export default function MapViewClient(props: MapViewProps) {
  return <MapView {...props} />;
}
