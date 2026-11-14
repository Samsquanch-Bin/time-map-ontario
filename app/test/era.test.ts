import assert from "node:assert/strict";
import { test } from "node:test";

import { ERAS, formatRange, matchingEra, normalise, overlaps } from "../src/logic/era";

test("overlaps is inclusive at both ends", () => {
  assert.equal(overlaps([1826, 1826], [1800, 1826]), true);
  assert.equal(overlaps([1826, 1826], [1827, 1900]), false);
  assert.equal(overlaps([1300, 2026], [1858, 1858]), true);
});

test("normalise clamps, rounds and orders", () => {
  assert.deepEqual(normalise([1900.4, 1700.6], 1300, 2026), [1701, 1900]);
  assert.deepEqual(normalise([1000, 3000], 1300, 2026), [1300, 2026]);
});

test("eras are contiguous and ordered", () => {
  for (let i = 1; i < ERAS.length; i++) {
    assert.ok(ERAS[i].range[0] <= ERAS[i - 1].range[1] + 1, `${ERAS[i].id} leaves a gap`);
    assert.ok(ERAS[i].range[0] > ERAS[i - 1].range[0]);
  }
});

test("matchingEra finds the chip for the selected range", () => {
  assert.equal(matchingEra([1763, 1841], 2026)?.id, "uppercanada");
  assert.equal(matchingEra([1914, 2026], 2026)?.id, "modern");
  assert.equal(matchingEra([1800, 1850], 2026), undefined);
});

test("formatRange", () => {
  assert.equal(formatRange([1826, 1826]), "1826");
  assert.equal(formatRange([1800, 1850]), "1800–1850");
});
