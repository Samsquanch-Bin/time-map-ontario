import assert from "node:assert/strict";
import { test } from "node:test";

import { editPin, formatCoords, googleMapsUrl, newPin, pinLabel, pinsGeoJSON } from "../src/logic/pins";

test("new and edited pins", () => {
  const p = newPin(-79.871234567891, 43.255712345678, "  Grandma's house ", " Built 1920 ", new Date("2026-11-18T00:00:00Z"));
  assert.equal(p.title, "Grandma's house");
  assert.equal(p.notes, "Built 1920");
  assert.equal(p.lon, -79.8712346);
  assert.equal(p.created, "2026-11-18T00:00:00.000Z");
  const q = editPin(p, "", "x", new Date("2026-11-19T00:00:00Z"));
  assert.equal(pinLabel(q), "Dropped pin");
  assert.equal(q.created, p.created);
  assert.equal(q.updated, "2026-11-19T00:00:00.000Z");
  assert.notEqual(newPin(0, 0, "", "").id, newPin(0, 0, "", "").id);
});

test("coordinates read latitude first", () => {
  assert.equal(formatCoords(-79.8711, 43.25571), "43.25571, -79.87110");
});

test("geojson includes the unsaved pin last", () => {
  const p = newPin(-79.8, 43.2, "A", "");
  const fc = pinsGeoJSON([p], { lon: -79.9, lat: 43.3 });
  assert.equal(fc.features.length, 2);
  assert.equal(fc.features[1].properties?.draft, true);
  assert.equal(pinsGeoJSON([], null).features.length, 0);
});

test("google maps link puts latitude first", () => {
  assert.equal(googleMapsUrl(-79.8711, 43.25571), "https://www.google.com/maps/search/?api=1&query=43.255710,-79.871100");
});
