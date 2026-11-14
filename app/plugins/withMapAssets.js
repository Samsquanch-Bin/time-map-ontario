// Copies app/map-assets/** (glyph PBFs and sprites fetched by
// scripts/fetch-map-assets.mjs) into the Android assets folder so the map style
// can load them offline with asset:// URLs.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

module.exports = function withMapAssets(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, "map-assets");
      const dest = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "assets");
      for (const sub of ["fonts", "sprites"]) {
        const dir = path.join(src, sub);
        if (!fs.existsSync(dir)) {
          throw new Error(`map-assets/${sub} missing: run "npm run map-assets" before prebuild`);
        }
        copyDir(dir, path.join(dest, sub));
      }
      return cfg;
    },
  ]);
};
