// Place-name search through OpenStreetMap's Nominatim service (free, no key).
// Only the typed text and the area to prefer are sent; nothing about the phone or its location.
// Nominatim's usage policy: at most one request a second, an identifying app name,
// and no search-as-you-type, so the app only searches when you press Search.
import type { LonLat } from "../logic/search";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Prefer results in Southern Ontario without excluding the rest of Canada.
const VIEWBOX = "-83.6,46.6,-74.3,41.6";

export type GeoResult = {
  id: string;
  name: string;
  detail: string;
  center: LonLat;
  bbox?: [number, number, number, number]; // w, s, e, n
};

let last = 0;

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url =
    `${NOMINATIM}?format=jsonv2&limit=8&countrycodes=ca&viewbox=${VIEWBOX}&bounded=0` + `&accept-language=en&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": "TimeMapOntario/1.0 (personal map app)", Accept: "application/json" } });
  if (!res.ok) throw new Error(`Search service answered ${res.status}.`);
  const rows = (await res.json()) as {
    place_id: number;
    display_name: string;
    name?: string;
    type?: string;
    lat: string;
    lon: string;
    boundingbox?: [string, string, string, string]; // s, n, w, e
  }[];
  return rows.map((r) => {
    const [first, ...rest] = r.display_name.split(", ");
    const bb = r.boundingbox?.map(Number);
    return {
      id: `osm-${r.place_id}`,
      name: r.name || first,
      detail: [r.type ? r.type.replace(/_/g, " ") : "", rest.slice(0, 3).join(", ")].filter(Boolean).join(" · "),
      center: [Number(r.lon), Number(r.lat)] as LonLat,
      bbox: bb && bb.every(Number.isFinite) ? [bb[2], bb[0], bb[3], bb[1]] : undefined,
    };
  });
}
