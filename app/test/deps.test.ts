import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Expo native modules must all match the Expo SDK major version, or Gradle fails
// with confusing autolinking errors (this happened once with expo-font 58).
test("installed expo-* modules match the Expo SDK version", () => {
  const nm = join(__dirname, "..", "node_modules");
  if (!existsSync(nm)) return;
  const sdk = JSON.parse(readFileSync(join(nm, "expo", "package.json"), "utf8")).version.split(".")[0];
  const bad = readdirSync(nm)
    .filter((d) => d.startsWith("expo-"))
    .map((d) => [d, JSON.parse(readFileSync(join(nm, d, "package.json"), "utf8")).version] as const)
    .filter(([, v]) => v.split(".")[0] !== sdk);
  assert.deepEqual(bad, [], `expo modules not on SDK ${sdk}`);
});
