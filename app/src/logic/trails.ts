// Trails pack (OpenStreetMap): how each kind of line is drawn and named.
export const TRAILS_FILE = "trails-south.pmtiles";

export type TrailKind = "bruce" | "side" | "route" | "path" | "minor";

// Bright colours over a dark outline, so trails stand out on satellite and on old maps.
export const TRAIL_KINDS: { id: TrailKind; label: string; color: string; width: number }[] = [
  { id: "bruce", label: "Bruce Trail", color: "#FF7A00", width: 4 },
  { id: "side", label: "Side trails", color: "#2F9BFF", width: 3 },
  { id: "route", label: "Other trails", color: "#FFE135", width: 3 },
  { id: "path", label: "Named paths", color: "#7CFF6B", width: 2.2 },
  { id: "minor", label: "Footpaths", color: "#F2F2F2", width: 1.4 },
];

export function trailKind(id: unknown): (typeof TRAIL_KINDS)[number] | undefined {
  return TRAIL_KINDS.find((k) => k.id === id);
}

/** MapLibre expression: a value per trail kind. */
export function byKind(pick: (k: (typeof TRAIL_KINDS)[number]) => string | number, fallback: string | number): unknown[] {
  return ["match", ["get", "kind"], ...TRAIL_KINDS.flatMap((k) => [k.id, pick(k)]), fallback];
}

const SURFACES: Record<string, string> = {
  ground: "earth", dirt: "earth", earth: "earth", grass: "grass", gravel: "gravel", fine_gravel: "fine gravel",
  compacted: "packed gravel", asphalt: "paved", paved: "paved", concrete: "paved", wood: "boardwalk", rock: "rock", sand: "sand",
};

export function surfaceText(s: unknown): string {
  return typeof s === "string" && s ? (SURFACES[s] ?? s.replace(/_/g, " ")) : "";
}
