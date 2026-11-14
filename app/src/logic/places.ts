// Researched places (see pipeline/tmo_pipeline/places.py for the source format).
import type { Feature, FeatureCollection, Polygon } from "geojson";

import { overlaps, type Range } from "./era";

export type Category = "battle" | "mill" | "lost-village" | "indigenous" | "settlers";

export const CATEGORIES: { id: Category; label: string; color: string; icon: string }[] = [
  { id: "battle", label: "Battles & forts", color: "#E0605E", icon: "sword-cross" },
  { id: "mill", label: "Mills", color: "#5FA8D3", icon: "fan" },
  { id: "settlers", label: "Early settlers", color: "#D9A066", icon: "home-variant-outline" },
  { id: "lost-village", label: "Lost villages", color: "#B58BD8", icon: "home-off-outline" },
  { id: "indigenous", label: "Indigenous settlements", color: "#5BC08A", icon: "campfire" },
];

export type Source = { title: string; url: string; licence?: string; retrieved: string };

export type Place = {
  id: string;
  title: string;
  category: Category;
  start: number;
  end: number;
  date_label: string;
  lon: number;
  lat: number;
  precision: "exact" | "approximate" | "area";
  location_basis: string;
  radius_m: number;
  nation: string;
  story: string;
  sources: Source[];
  researched_by: string;
  sample: boolean;
  area?: Polygon;
};

export function parsePlaces(text: string): Place[] {
  const data = JSON.parse(text);
  if (data?.version !== 1 || !Array.isArray(data.places)) throw new Error("Unsupported places format");
  return data.places as Place[];
}

export function visiblePlaces(places: Place[], era: Range, hidden: Category[]): Place[] {
  const off = new Set(hidden);
  return places.filter((p) => !off.has(p.category) && overlaps([p.start, p.end], era));
}

/** Points for exactly-located places, shaded circles for approximate ones. */
export function placesToGeoJSON(places: Place[]): FeatureCollection {
  const features: Feature[] = places.map((p) => ({
    type: "Feature",
    id: p.id,
    properties: {
      id: p.id,
      title: p.title,
      category: p.category,
      color: CATEGORIES.find((c) => c.id === p.category)?.color ?? "#999999",
      sample: p.sample,
    },
    geometry: p.precision === "exact" || !p.area ? { type: "Point", coordinates: [p.lon, p.lat] } : p.area,
  }));
  return { type: "FeatureCollection", features };
}

export function precisionText(p: Place): string {
  if (p.precision === "exact") return `Location as published: ${p.location_basis}`;
  const km = p.radius_m >= 1000 ? `${(p.radius_m / 1000).toFixed(p.radius_m % 1000 ? 1 : 0)} km` : `${p.radius_m} m`;
  return `${p.precision === "area" ? "General area" : "Approximate location"} (within about ${km}): ${p.location_basis}`;
}
