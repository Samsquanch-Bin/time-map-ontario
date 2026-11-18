import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePlaquesPage, plaqueWhere, plaquesGeoJSON, plaquesPageUrl, safeUrl } from "../src/logic/plaques";

// Made-up sample in the shape the Trust's service returns (not real plaque data).
const page = {
  exceededTransferLimit: true,
  features: [
    {
      attributes: { OBJECTID_1: 7, Unique_Name: " Test Plaque ", Plaque_text: "Line one.", Municipality_Lower_Single: "Hamilton", Municipality_Upper_District: "Hamilton", Country: "Canada", Web_URL: "https://example.org/p", SVI_URL: "javascript:alert(1)" },
      geometry: { x: -79.87, y: 43.25 },
    },
    { attributes: { OBJECTID_1: 8, Unique_Name: "No position" }, geometry: null },
    { attributes: { OBJECTID_1: 9, Unique_Name: "Projected" }, geometry: { x: 591000, y: 4789000 } },
  ],
};

test("parses plaques exactly, skipping ones without a usable position", () => {
  const { plaques, more } = parsePlaquesPage(page);
  assert.equal(more, true);
  assert.equal(plaques.length, 1);
  const p = plaques[0];
  assert.equal(p.id, "7");
  assert.equal(p.name, "Test Plaque");
  assert.equal(p.text, "Line one.");
  assert.deepEqual([p.lon, p.lat], [-79.87, 43.25]);
  assert.equal(p.webUrl, "https://example.org/p");
  assert.equal(p.streetViewUrl, "");
  assert.equal(plaqueWhere(p), "Hamilton");
});

test("service errors are reported", () => {
  assert.throws(() => parsePlaquesPage({ error: { message: "Invalid query" } }), /Invalid query/);
});

test("query asks for WGS84 points in pages", () => {
  const u = plaquesPageUrl(1000, 500);
  assert.match(u, /outSR=4326/);
  assert.match(u, /resultOffset=1000/);
  assert.match(u, /resultRecordCount=500/);
  assert.match(u, /orderByFields=OBJECTID_1/);
});

test("geojson and links", () => {
  const fc = plaquesGeoJSON(parsePlaquesPage(page).plaques);
  assert.equal(fc.features.length, 1);
  assert.equal(safeUrl("ftp://x"), "");
});
