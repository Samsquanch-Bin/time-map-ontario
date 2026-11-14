// Search helpers: reading typed coordinates, and matching names on the phone.
// Pure functions so they can be unit-tested.

export type LonLat = [number, number];

/** One decimal or degrees-minutes-seconds value, with an optional N/S/E/W letter. */
function parseOne(raw: string): { value: number; hemi: string | null } | null {
  const t = raw.trim().toUpperCase();
  const hemiMatch = t.match(/[NSEW]/);
  const hemi = hemiMatch ? hemiMatch[0] : null;
  const nums = t.replace(/[NSEW]/g, " ").match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length > 3) return null;
  const [d, m = "0", s = "0"] = nums;
  const deg = Number(d);
  const value = Math.sign(deg || 1) * (Math.abs(deg) + Number(m) / 60 + Number(s) / 3600);
  if (!Number.isFinite(value)) return null;
  const neg = hemi === "S" || hemi === "W";
  return { value: neg ? -Math.abs(value) : value, hemi };
}

/**
 * Read coordinates typed or pasted in the usual ways:
 * "43.2557, -79.8711", "43.2557 -79.8711", "-79.8711, 43.2557" (longitude first),
 * "43°15'20.5\"N 79°52'16\"W", "N 43.2557 W 79.8711". Returns [lon, lat] or null.
 */
export function parseCoordinates(text: string): LonLat | null {
  const t = text.trim().replace(/[°º'′"″]/g, " ").replace(/\s+/g, " ");
  if (!/\d/.test(t) || /[A-DF-MO-RT-VX-Z]/i.test(t)) return null; // letters other than N/S/E/W: not coordinates
  let parts: string[];
  if (t.includes(",")) parts = t.split(",");
  else {
    // "N 43 15 20 W 79 52 16" / "43.25 -79.87": split before the second hemisphere letter or number group
    const hemis = [...t.matchAll(/[NSEW]/gi)];
    if (hemis.length === 2) {
      const cut = /^[NSEW]/i.test(t) ? hemis[1].index! : hemis[0].index! + 1;
      parts = [t.slice(0, cut), t.slice(cut)];
    } else {
      const nums = t.split(" ").filter(Boolean);
      if (nums.length === 2) parts = nums;
      else if (nums.length % 2 === 0) parts = [nums.slice(0, nums.length / 2).join(" "), nums.slice(nums.length / 2).join(" ")];
      else return null;
    }
  }
  if (parts.length !== 2) return null;
  const a = parseOne(parts[0]);
  const b = parseOne(parts[1]);
  if (!a || !b) return null;
  let lat = a.value;
  let lon = b.value;
  // Longitude given first: by its letter, because it can't be a latitude, or (no letters)
  // negative then positive, which in this part of the world means west longitude, north latitude.
  const lonFirst =
    a.hemi === "E" || a.hemi === "W" || b.hemi === "N" || b.hemi === "S" ||
    (Math.abs(a.value) > 90 && Math.abs(b.value) <= 90) ||
    (!a.hemi && !b.hemi && a.value < 0 && b.value > 0);
  if (lonFirst) {
    [lat, lon] = [b.value, a.value];
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Items whose name contains every word typed, best (starts-with) matches first. */
export function matchNames<T>(items: T[], query: string, name: (t: T) => string, limit = 5): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const q = fold(query.trim());
  return items
    .map((it) => ({ it, n: fold(name(it)) }))
    .filter(({ n }) => words.every((w) => n.includes(w)))
    .sort((x, y) => Number(y.n.startsWith(q)) - Number(x.n.startsWith(q)) || x.n.length - y.n.length)
    .slice(0, limit)
    .map(({ it }) => it);
}
