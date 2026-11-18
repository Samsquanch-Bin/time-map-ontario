// Monuments & battlefields pack (OpenStreetMap).
import type { Place } from "./places";

export const MONUMENTS_FILE = "monuments-south.pmtiles";

export const MONUMENT_KINDS = [
  { id: "monument", label: "Monuments & cairns", color: "#E9DCC0", stroke: "#3B2A14" },
  { id: "war_memorial", label: "War memorials", color: "#C9A227", stroke: "#2B1D05" },
  { id: "battlefield", label: "Battlefields", color: "#E53935", stroke: "#FFFFFF" },
] as const;

export function monumentKind(id: unknown) {
  return MONUMENT_KINDS.find((k) => k.id === id);
}

/** OSM's wikipedia tag ("en:Battle of Stoney Creek") as a link. */
export function wikipediaUrl(tag: unknown): string {
  if (typeof tag !== "string" || !tag.includes(":")) return "";
  const i = tag.indexOf(":");
  const lang = tag.slice(0, i).trim();
  const title = tag.slice(i + 1).trim();
  if (!/^[a-z-]{2,12}$/.test(lang) || !title) return "";
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** Metres between two points (good enough at these distances). */
export function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Researched places within `radius` metres, nearest first (to link a monument to its story). */
export function storiesNear(places: Place[], at: [number, number], radius = 2000): Place[] {
  return places
    .map((p) => ({ p, d: distanceM(at, [p.lon, p.lat]) }))
    .filter((x) => x.d <= radius)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.p);
}
