// Pure style helpers (no React Native imports, so they're unit-testable).

/** Replace any font stack name with spaces (e.g. "Noto Sans Devanagari Regular v1")
 * by the bundled fallback; bundled font folders have no spaces in their names. */
export function styleWithFonts<T>(style: T, fallback: string): T {
  const json = JSON.stringify(style).replace(/"Noto Sans [^"]*"/g, `"${fallback}"`);
  return JSON.parse(json) as T;
}

/** Every font name referenced in the style's text-font properties. */
export function fontStacks(style: { layers: Array<{ layout?: Record<string, unknown> }> }): Set<string> {
  const out = new Set<string>();
  const collect = (v: unknown) => {
    if (typeof v === "string" && /^Noto/.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(collect);
  };
  for (const l of style.layers) collect(l.layout?.["text-font"]);
  return out;
}
