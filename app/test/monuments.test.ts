import assert from "node:assert/strict";
import { test } from "node:test";

import { distanceM, monumentKind, wikipediaUrl } from "../src/logic/monuments";

test("monument helpers", () => {
  assert.equal(wikipediaUrl("en:Battle of Stoney Creek"), "https://en.wikipedia.org/wiki/Battle_of_Stoney_Creek");
  assert.equal(wikipediaUrl("nonsense"), "");
  assert.equal(monumentKind("battlefield")?.label, "Battlefields");
  const d = distanceM([-79.7642, 43.2183], [-79.7642, 43.2273]); // 0.009° of latitude ≈ 1 km
  assert.ok(d > 990 && d < 1010);
});
