import assert from "node:assert/strict";
import { test } from "node:test";

import { matchNames, parseCoordinates } from "../src/logic/search";

const near = (a: [number, number] | null, b: [number, number]) =>
  assert.ok(a && Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);

test("reads decimal coordinates in either order", () => {
  near(parseCoordinates("43.2557, -79.8711"), [-79.8711, 43.2557]);
  near(parseCoordinates("43.2557 -79.8711"), [-79.8711, 43.2557]);
  near(parseCoordinates("-79.8711, 43.2557"), [-79.8711, 43.2557]);
  near(parseCoordinates(" 43.2557,-79.8711 "), [-79.8711, 43.2557]);
});

test("reads degrees, minutes, seconds and hemisphere letters", () => {
  near(parseCoordinates(`43°15'20.5"N 79°52'16"W`), [-(79 + 52 / 60 + 16 / 3600), 43 + 15 / 60 + 20.5 / 3600]);
  near(parseCoordinates("N 43.2557 W 79.8711"), [-79.8711, 43.2557]);
  near(parseCoordinates("43.2557N, 79.8711W"), [-79.8711, 43.2557]);
  near(parseCoordinates("79.8711W 43.2557N"), [-79.8711, 43.2557]);
});

test("names and nonsense are not coordinates", () => {
  assert.equal(parseCoordinates("Gage Park"), null);
  assert.equal(parseCoordinates("1812"), null);
  assert.equal(parseCoordinates("95, 200"), null);
  assert.equal(parseCoordinates("Highway 403"), null);
});

test("matches names by every word, ignoring accents and case", () => {
  const items = ["Battle of Stoney Creek", "Stoney Creek mill", "Fort George", "Étienne's ford"];
  assert.deepEqual(matchNames(items, "stoney", (s) => s), ["Stoney Creek mill", "Battle of Stoney Creek"]);
  assert.deepEqual(matchNames(items, "creek battle", (s) => s), ["Battle of Stoney Creek"]);
  assert.deepEqual(matchNames(items, "etienne", (s) => s), ["Étienne's ford"]);
  assert.deepEqual(matchNames(items, "  ", (s) => s), []);
});
