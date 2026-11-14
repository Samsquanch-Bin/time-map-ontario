import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { buildBaseStyle, firstLabelLayerId } from "../src/map/baseStyle";
import { fontStacks } from "../src/logic/style";

const ASSETS = join(__dirname, "..", "map-assets");

for (const theme of ["dark", "light"] as const) {
  test(`${theme} style only uses bundled, space-free fonts`, () => {
    const style = buildBaseStyle(theme, "pmtiles://file:///x/basemap-south.pmtiles") as any;
    const fonts = fontStacks(style);
    assert.ok(fonts.size > 0);
    for (const f of fonts) {
      assert.ok(!f.includes(" "), `font "${f}" has a space`);
      if (existsSync(ASSETS)) assert.ok(existsSync(join(ASSETS, "fonts", f, "0-255.pbf")), `font ${f} not bundled`);
    }
    assert.equal(style.glyphs, "asset://fonts/{fontstack}/{range}.pbf");
    assert.equal(style.sprite, `asset://sprites/${theme}`);
    if (existsSync(ASSETS)) assert.ok(readdirSync(join(ASSETS, "sprites")).includes(`${theme}.json`));
    assert.ok(firstLabelLayerId(style), "style has a label layer to insert overlays under");
  });
}

test("without a basemap the style is just a background", () => {
  const style = buildBaseStyle("dark", null);
  assert.equal(style.layers.length, 1);
  assert.equal(style.layers[0].type, "background");
});
