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
  file: string;
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

export function hasPack(catalog: Catalog | null, installed: Installed, file: string): boolean {
  const p = catalog?.packs.find((x) => x.file === file);
  return !!p && installed[file] === p.sha256;
}
