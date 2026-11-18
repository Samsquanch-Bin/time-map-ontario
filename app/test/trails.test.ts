import assert from "node:assert/strict";
import { test } from "node:test";

import { byKind, surfaceText, trailKind } from "../src/logic/trails";

test("trail kinds", () => {
  assert.equal(trailKind("bruce")?.label, "Bruce Trail");
  assert.equal(trailKind("nope"), undefined);
  const e = byKind((k) => k.color, "#fff");
  assert.equal(e[0], "match");
  assert.equal(e[e.length - 1], "#fff");
  assert.equal(surfaceText("fine_gravel"), "fine gravel");
  assert.equal(surfaceText(undefined), "");
});
