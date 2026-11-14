// Era / time-slider logic. Pure functions so they can be unit-tested.

export type Range = [number, number];

export type Era = { id: string; label: string; range: Range };

export const ERAS: Era[] = [
  { id: "pre1650", label: "Before 1650", range: [1300, 1649] },
  { id: "newfrance", label: "1650–1763", range: [1650, 1763] },
  { id: "uppercanada", label: "1763–1841", range: [1763, 1841] },
  { id: "canadawest", label: "1841–1867", range: [1841, 1867] },
  { id: "ontario", label: "1867–1914", range: [1867, 1914] },
  { id: "modern", label: "1914–now", range: [1914, 9999] },
];

/** True when [a0,a1] and [b0,b1] share at least one year. */
export function overlaps(a: Range, b: Range): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/** Clamp a range to [min,max] and make sure start <= end. */
export function normalise(range: Range, min: number, max: number): Range {
  const lo = Math.max(min, Math.min(max, Math.round(Math.min(range[0], range[1]))));
  const hi = Math.max(min, Math.min(max, Math.round(Math.max(range[0], range[1]))));
  return [lo, hi];
}

/** Era whose range exactly matches the selection, if any (for highlighting a chip). */
export function matchingEra(range: Range, max: number): Era | undefined {
  return ERAS.find((e) => e.range[0] === range[0] && Math.min(e.range[1], max) === range[1]);
}

export function formatRange([a, b]: Range): string {
  return a === b ? `${a}` : `${a}–${b}`;
}
