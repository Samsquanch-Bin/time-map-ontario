// Your own pins: dropped by pressing and holding on the map, with a name and notes.
// Kept only on this phone (app storage); never sent anywhere.
import type { FeatureCollection } from "geojson";

export type MyPin = {
  id: string;
  lon: number;
  lat: number;
  title: string;
  notes: string;
  created: string; // ISO time
  updated: string;
};

export function newPin(lon: number, lat: number, title: string, notes: string, now = new Date()): MyPin {
  const t = now.toISOString();
  return {
    id: `pin-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    lon: round(lon),
    lat: round(lat),
    title: title.trim(),
    notes: notes.trim(),
    created: t,
    updated: t,
  };
}

export function editPin(pin: MyPin, title: string, notes: string, now = new Date()): MyPin {
  return { ...pin, title: title.trim(), notes: notes.trim(), updated: now.toISOString() };
}

/** About 1 cm of precision: plenty, and keeps the saved numbers tidy. */
function round(v: number): number {
  return Math.round(v * 1e7) / 1e7;
}

/** "43.25571, -79.87110" (latitude first, as maps and GPS apps expect). */
export function formatCoords(lon: number, lat: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export function pinLabel(p: MyPin): string {
  return p.title || "Dropped pin";
}

export function pinsGeoJSON(pins: MyPin[], draft?: { lon: number; lat: number } | null): FeatureCollection {
  const features: FeatureCollection["features"] = pins.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    properties: { id: p.id, title: pinLabel(p), draft: false },
  }));
  if (draft) {
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [draft.lon, draft.lat] }, properties: { id: "draft", title: "", draft: true } });
  }
  return { type: "FeatureCollection", features };
}
