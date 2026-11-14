// Downloads the glyphs and sprites the offline map style needs from
// github.com/protomaps/basemaps-assets (fonts: SIL OFL 1.1, sprites: MIT-derived)
// into app/map-assets/. Font folder names have their spaces removed because they
// are used inside asset:// URLs (see src/map/baseStyle.ts).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "map-assets");
const BASE = "https://raw.githubusercontent.com/protomaps/basemaps-assets/main";
const FONTS = ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"];
// Unicode blocks: Latin + Latin-1, Latin Extended A/B, IPA/spacing, combining marks,
// Latin Extended Additional, punctuation, and Unified Canadian Aboriginal Syllabics
// (for Indigenous place names written in syllabics).
const RANGES = [0, 256, 512, 768, 7680, 7936, 8192, 8448, 5120, 5376, 5632, 65280];
const SPRITES = ["dark", "dark@2x", "light", "light@2x"];

async function get(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 404) return null;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw new Error(`failed to fetch ${url}`);
}

let count = 0;
for (const font of FONTS) {
  const dir = join(ROOT, "fonts", font.replaceAll(" ", ""));
  await mkdir(dir, { recursive: true });
  for (const start of RANGES) {
    const range = `${start}-${start + 255}`;
    const data = await get(`${BASE}/fonts/${encodeURIComponent(font)}/${range}.pbf`);
    if (data) {
      await writeFile(join(dir, `${range}.pbf`), data);
      count++;
    }
  }
}
for (const name of SPRITES) {
  for (const ext of ["json", "png"]) {
    const data = await get(`${BASE}/sprites/v4/${name}.${ext}`);
    if (!data) throw new Error(`sprite ${name}.${ext} not found`);
    await mkdir(join(ROOT, "sprites"), { recursive: true });
    await writeFile(join(ROOT, "sprites", `${name}.${ext}`), data);
    count++;
  }
}
console.log(`map-assets: wrote ${count} files to ${ROOT}`);
