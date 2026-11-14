import assert from "node:assert/strict";
import { test } from "node:test";

import { type Catalog, chooseOverlay, covers, formatBytes, mapsHere, type Overlay, hasPack, packsToDownload, parseCatalog, staleFiles, totalBytes } from "../src/logic/catalog";

const catalog: Catalog = {
  version: 1,
  generated_at: "2026-11-14T00:00:00+00:00",
  focus_bbox: [-80.3, 42.8, -78.6, 44.5],
  basemap_bbox: [-83.6, 41.6, -74.3, 46.6],
  packs: [
    { file: "basemap-south.pmtiles", kind: "basemap", bytes: 1_200_000_000, sha256: "a".repeat(64), url: "https://x/b" },
    { file: "overlay-niagara-1826.pmtiles", kind: "overlay", bytes: 30_000_000, sha256: "b".repeat(64), url: "https://x/o" },
  ],
  overlays: [],
  attributions: [],
};

test("only missing or changed packs are downloaded", () => {
  assert.equal(packsToDownload(catalog, {}).length, 2);
  const installed = { "basemap-south.pmtiles": "a".repeat(64), "overlay-niagara-1826.pmtiles": "old" };
  assert.deepEqual(packsToDownload(catalog, installed).map((p) => p.file), ["overlay-niagara-1826.pmtiles"]);
});

test("files no longer listed are stale", () => {
  assert.deepEqual(staleFiles(catalog, { "basemap-south.pmtiles": "a", "overlay-gone.pmtiles": "c" }), ["overlay-gone.pmtiles"]);
});

test("hasPack needs a matching hash", () => {
  assert.equal(hasPack(catalog, { "basemap-south.pmtiles": "a".repeat(64) }, "basemap-south.pmtiles"), true);
  assert.equal(hasPack(catalog, { "basemap-south.pmtiles": "old" }, "basemap-south.pmtiles"), false);
  assert.equal(hasPack(null, {}, "basemap-south.pmtiles"), false);
});

test("sizes", () => {
  assert.equal(totalBytes(catalog.packs), 1_230_000_000);
  assert.equal(formatBytes(1_230_000_000), "1.23 GB");
  assert.equal(formatBytes(30_000_000), "30 MB");
});

test("parseCatalog rejects unknown versions", () => {
  assert.throws(() => parseCatalog(JSON.stringify({ version: 2, packs: [], overlays: [] })));
  assert.equal(parseCatalog(JSON.stringify(catalog)).packs.length, 2);
});

test("online overlays are available without a pack; offline ones need theirs", async () => {
  const { overlayAvailable } = await import("../src/logic/catalog");
  const o = { file: "overlay-niagara-1826.pmtiles" } as any;
  assert.equal(overlayAvailable(catalog, {}, o), false);
  assert.equal(overlayAvailable(catalog, { "overlay-niagara-1826.pmtiles": "b".repeat(64) }, o), true);
  assert.equal(overlayAvailable(catalog, {}, { tiles: "https://x/{z}/{y}/{x}" } as any), true);
});

test("overlaysInView lists maps covering the view, most detailed first", async () => {
  const { overlaysInView } = await import("../src/logic/catalog");
  const county = { id: "county", bounds: [-80.4, 42.6, -79.1, 43.6] } as any;
  const city = { id: "city", bounds: [-79.9, 43.2, -79.8, 43.3] } as any;
  const far = { id: "far", bounds: [-79.4, 43.6, -79.3, 43.7] } as any;
  const hamilton: [number, number, number, number] = [-79.9, 43.22, -79.85, 43.27];
  assert.deepEqual(overlaysInView([county, far, city], hamilton).map((o) => o.id), ["city", "county"]);
  assert.deepEqual(overlaysInView([county], null), []);
});

const box = (id: string, b: [number, number, number, number], maxzoom: number, minzoom = 10, year = 1900) =>
  ({
    id, title: id, year, era: [year, year], accuracy_note: "", minzoom, maxzoom, bounds: b,
    footprint: { type: "Polygon", coordinates: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]] },
    source_id: "x", licence: "", licence_status: "confirmed", attribution: "x", sample: false,
  }) as Overlay;

test("auto choice prefers the local, detailed map over county maps and air photos", () => {
  const county = box("county", [-80.2, 43.0, -79.6, 43.5], 16);
  const air = box("air", [-79.9, 43.1, -79.5, 43.4], 19, 11);
  const fip = box("fip", [-79.88, 43.25, -79.85, 43.27], 20, 14);
  const pt: [number, number] = [-79.87, 43.26];
  assert.deepEqual(mapsHere([county, air, fip], pt, 15).map((o) => o.id), ["fip", "air", "county"]);
  // too far out for the fire plan: next best
  assert.deepEqual(mapsHere([county, air, fip], pt, 12).map((o) => o.id), ["air", "county"]);
});

test("nothing is picked automatically at region scale, and a picked map sticks while it covers the spot", () => {
  const a = box("a", [-80, 43, -79, 44], 16);
  const b = box("b", [-79.6, 43.4, -79.4, 43.6], 18);
  const here = mapsHere([a, b], [-79.5, 43.5], 12);
  assert.equal(chooseOverlay(here, null, 12)?.id, "b");
  assert.equal(chooseOverlay(here, "a", 12)?.id, "a");
  assert.equal(chooseOverlay(here, "gone", 12)?.id, "b");
  assert.equal(chooseOverlay(mapsHere([a, b], [-79.5, 43.5], 10), null, 10), null);
});

test("covers uses the scanned footprint, not the bounding box", () => {
  const o = box("l", [0, 0, 2, 2], 16);
  o.footprint = { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], [[[1.5, 1.5], [2, 1.5], [2, 2], [1.5, 2], [1.5, 1.5]]]] };
  assert.equal(covers(o, [0.5, 0.5]), true);
  assert.equal(covers(o, [1.2, 1.2]), false);
  assert.equal(covers(o, [1.8, 1.8]), true);
});
