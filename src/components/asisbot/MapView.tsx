"use client";

// Mapa del día: geocercas (círculos) + marcaciones de hoy.
// Tiles claros de CARTO/OSM, gratuitos y sin API key (requisito del brief).

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Zone } from "./types";
import { STATUS_LABEL } from "./types";
import { fmtHHMM } from "./format";

export interface MapPoint {
  id: string;
  lat: number | null;
  lng: number | null;
  status: string;
  type: string;
  timestamp: string;
  workerName: string;
}

function FitBounds({ zones }: { zones: Zone[] }) {
  const map = useMap();
  useEffect(() => {
    if (zones.length === 0) return;
    const bounds = L.latLngBounds(
      zones.map((z) => L.latLng(z.lat, z.lng).toBounds(z.radiusM * 2.6)),
    );
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [zones, map]);
  return null;
}

function statusColor(status: string): string {
  switch (status) {
    case "APROBADA":
      return "#0e7a47";
    case "EN_REVISION":
      return "#b45309";
    case "RECHAZADA":
      return "#c4242a";
    default:
      return "#5d645d";
  }
}

export default function MapView({
  zones,
  points,
  className = "",
}: {
  zones: Zone[];
  points: MapPoint[];
  className?: string;
}) {
  const valid = points.filter((p) => p.lat !== null && p.lng !== null);
  return (
    // `isolate` + `relative z-0`: crea un stacking context propio que encierra
    // los z-index internos de Leaflet (200–1000). Sin esto, los paneles del mapa
    // pintan por encima de diálogos/sheets (z-50) y el formulario de nueva zona
    // queda "detrás" del mapa.
    <div
      className={`relative z-0 isolate overflow-hidden rounded-lg border border-border ${className}`}
      data-ui
    >
      <MapContainer
        center={[-33.41, -70.7]}
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · colaboradores'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zones.map((z) => (
          <Circle
            key={z.id}
            center={[z.lat, z.lng]}
            radius={z.radiusM}
            pathOptions={{
              color: "#0e7a47",
              weight: 1.5,
              fillColor: "#0e7a47",
              fillOpacity: 0.07,
            }}
          >
            <Tooltip direction="top">
              <strong>{z.name}</strong> · radio {z.radiusM} m
            </Tooltip>
          </Circle>
        ))}
        {valid.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat!, p.lng!]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: statusColor(p.status),
              fillOpacity: 0.95,
            }}
          >
            <Tooltip direction="top">
              <strong>{p.workerName}</strong>
              <br />
              {p.type === "ENTRADA" ? "Entrada" : "Salida"} {fmtHHMM(p.timestamp)} ·{" "}
              {STATUS_LABEL[p.status] ?? p.status}
            </Tooltip>
          </CircleMarker>
        ))}
        <FitBounds zones={zones} />
      </MapContainer>
    </div>
  );
}
