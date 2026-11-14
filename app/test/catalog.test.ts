import assert from "node:assert/strict";
import { test } from "node:test";

import { type Catalog, formatBytes, hasPack, packsToDownload, parseCatalog, staleFiles, totalBytes } from "../src/logic/catalog";

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
