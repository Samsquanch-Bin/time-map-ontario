// Types for catalog.json (see schemas/catalog.schema.json) and pure helpers.
import type { MultiPolygon, Polygon } from "geojson";

export type PackKind = "basemap" | "overlay" | "terrain" | "trails" | "places";

export type Pack = { file: string; kind: PackKind; bytes: number; sha256: string; url: string };

export type Overlay = {
  id: string;
  title: string;
  year: number;
  era: [number, number];
  description?: string;
  accuracy_note: string;
  /** Offline overlays: a PMTiles pack on the phone. */
  file?: string;
  /** Online overlays: tiles streamed from the holder's server ({z}/{x}/{y} template). */
  tiles?: string;
  tile_size?: number;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  footprint: Polygon | MultiPolygon;
  source_id: string;
  source_url?: string;
  licence: string;
  licence_status: "confirmed" | "unconfirmed";
  source_item_licence?: string;
  attribution: string;
  sample: boolean;
};

export type Attribution = {
  source_id: string;
  name: string;
  text: string;
  licence: string;
  licence_url?: string;
  licence_status: "confirmed" | "unconfirmed";
  homepage?: string;
};

export type Catalog = {
  version: 1;
  generated_at: string;
  focus_bbox: [number, number, number, number];
  basemap_bbox: [number, number, number, number];
  packs: Pack[];
  overlays: Overlay[];
  attributions: Attribution[];
};

/** Installed = file name -> sha256 of the copy on the phone. */
export type Installed = Record<string, string>;

export function parseCatalog(text: string): Catalog {
  const c = JSON.parse(text);
  if (c?.version !== 1 || !Array.isArray(c.packs) || !Array.isArray(c.overlays)) {
    throw new Error("Unsupported catalog format — update the app.");
  }
  return c as Catalog;
}

/** Packs that are missing or out of date on the phone. */
export function packsToDownload(catalog: Catalog, installed: Installed): Pack[] {
  return catalog.packs.filter((p) => installed[p.file] !== p.sha256);
}

/** Files on the phone that the new catalog no longer lists. */
export function staleFiles(catalog: Catalog, installed: Installed): string[] {
  const keep = new Set(catalog.packs.map((p) => p.file));
  return Object.keys(installed).filter((f) => !keep.has(f));
}

export function totalBytes(packs: Pack[]): number {
  return packs.reduce((s, p) => s + p.bytes, 0);
}

export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} kB`;
  return `${n} B`;
}

/** Can this overlay be shown now? Offline ones need their pack; online ones always can (with a connection). */
export function overlayAvailable(catalog: Catalog | null, installed: Installed, o: Overlay): boolean {
  return o.tiles ? true : !!o.file && hasPack(catalog, installed, o.file);
}

export type Bounds = [number, number, number, number];

function intersects(a: Bounds, b: Bounds): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

/** Overlays covering the current view, most detailed (smallest area) first. */
export function overlaysInView(overlays: Overlay[], view: Bounds | null): Overlay[] {
  if (!view) return [];
  const area = (b: Bounds) => (b[2] - b[0]) * (b[3] - b[1]);
  return overlays.filter((o) => intersects(o.bounds, view)).sort((a, b) => area(a.bounds) - area(b.bounds));
}

export function hasPack(catalog: Catalog | null, installed: Installed, file: string): boolean {
  const p = catalog?.packs.find((x) => x.file === file);
  return !!p && installed[file] === p.sha256;
}

// ------------------------------------------------------------ automatic map choice

/** Below this zoom the app shows no old map on its own: at region scale they'd just pile up. */
export const AUTO_MIN_ZOOM = 11;

type Ring = number[][];

function inRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Is the point on the scanned part of this map (not just inside its bounding box)? */
export function covers(o: Overlay, pt: [number, number]): boolean {
  const [w, s, e, n] = o.bounds;
  if (pt[0] < w || pt[0] > e || pt[1] < s || pt[1] > n) return false;
  const polys: Ring[][] = o.footprint.type === "Polygon" ? [o.footprint.coordinates] : o.footprint.coordinates;
  return polys.some(([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h)));
}

/**
 * How "local" a map is. Maps that show individual houses and lots (fire insurance
 * plans, town plans) are both the most zoomable and cover the smallest area, so
 * score = deepest zoom + half a point for every halving of the area covered.
 */
export function detailScore(o: Overlay): number {
  const [w, s, e, n] = o.bounds;
  const area = Math.max(1e-9, (e - w) * (n - s));
  return o.maxzoom - 0.5 * Math.log2(area);
}

/** Maps covering this spot that can be drawn at this zoom, most local first. */
export function mapsHere(overlays: Overlay[], center: [number, number], zoom: number): Overlay[] {
  return overlays
    .filter((o) => zoom >= o.minzoom && covers(o, center))
    .sort((a, b) => detailScore(b) - detailScore(a) || a.year - b.year);
}

/**
 * The map to show: the one the person picked if it still covers this spot,
 * otherwise the most local one (nothing when zoomed out to region scale).
 */
export function chooseOverlay(here: Overlay[], pickedId: string | null, zoom: number): Overlay | null {
  const picked = pickedId ? here.find((o) => o.id === pickedId) : undefined;
  if (picked) return picked;
  return zoom >= AUTO_MIN_ZOOM ? (here[0] ?? null) : null;
}
