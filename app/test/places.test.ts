import assert from "node:assert/strict";
import { test } from "node:test";

import { type Place, placesToGeoJSON, precisionText, visiblePlaces } from "../src/logic/places";

const base: Place = {
  id: "a", title: "A", category: "battle", start: 1813, end: 1813, date_label: "1813",
  lon: -79.7, lat: 43.2, precision: "exact", location_basis: "Wikidata P625", radius_m: 0,
  nation: "", story: "s", sources: [], researched_by: "Claude (unreviewed)", sample: false,
};
const area: Place = {
  ...base, id: "b", category: "indigenous", start: 1550, end: 1600, precision: "approximate", radius_m: 1500,
  area: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
};

test("filters by era and hidden categories", () => {
  assert.deepEqual(visiblePlaces([base, area], [1800, 1900], []).map((p) => p.id), ["a"]);
  assert.deepEqual(visiblePlaces([base, area], [1300, 2026], ["battle"]).map((p) => p.id), ["b"]);
});

test("exact places are points, approximate ones are areas", () => {
  const fc = placesToGeoJSON([base, area]);
  assert.equal(fc.features[0].geometry.type, "Point");
  assert.equal(fc.features[1].geometry.type, "Polygon");
});

test("precision text says how sure the location is", () => {
  assert.match(precisionText(base), /as published/);
  assert.match(precisionText(area), /Approximate location \(within about 1.5 km\)/);
});
