import type { Zone } from "./types";

export interface MapPoint {
  id: string;
  lat: number | null;
  lng: number | null;
  status: string;
  type: string;
  timestamp: string;
  workerName: string;
}

export interface MapViewProps {
  zones: Zone[];
  points: MapPoint[];
  className?: string;
}
