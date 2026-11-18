// Ontario Heritage Trust provincial plaques (Ontario Provincial Plaque Program).
//
// The Trust's data terms allow personal, non-commercial viewing and use with credit,
// and do NOT allow redistribution. So the plaques are never packaged by the data build
// or published anywhere: the phone fetches them straight from the Trust's own map
// service and keeps that copy for this phone only. Text and positions are shown
// exactly as the Trust publishes them.

import type { FeatureCollection } from "geojson";

export const PLAQUES_SERVICE =
  "https://services5.arcgis.com/wMPKKIM77NIigfTk/arcgis/rest/services/Ontario_Provincial_Plaques_View/FeatureServer/0";
export const PLAQUES_MAP_URL = "https://experience.arcgis.com/experience/6be55747ebb947b789f37e34f633b705";
export const PLAQUES_CREDIT = "Ontario Heritage Trust, Ontario Provincial Plaque Program";
export const PLAQUES_TERMS =
  "Data provided by the Ontario Heritage Trust for personal, non-commercial use. It is fetched straight from the Trust's map service onto this phone and is not shared or redistributed. The Trust makes no guarantee that it is complete or correct.";

export const PLAQUE_FIELDS = [
  "OBJECTID_1",
  "Unique_Name",
  "Plaque_text",
  "Location",
  "Street_address",
  "Postal_Code",
  "Municipality_Lower_Single",
  "Municipality_Upper_District",
  "Province",
  "Country",
  "Themes",
  "Fr_Title",
  "Fr_PlaqueText",
  "Fr_Location",
  "SVI_URL",
  "Web_URL",
] as const;

export type Plaque = {
  id: string;
  name: string;
  text: string;
  location: string;
  address: string;
  postalCode: string;
  municipality: string;
  district: string;
  province: string;
  country: string;
  themes: string;
  frTitle: string;
  frText: string;
  frLocation: string;
  streetViewUrl: string;
  webUrl: string;
  lon: number;
  lat: number;
};

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/** A query URL for one page of plaques (WGS84 coordinates, every field the app shows). */
export function plaquesPageUrl(offset: number, count = 1000): string {
  const q = new URLSearchParams({
    where: "1=1",
    outFields: PLAQUE_FIELDS.join(","),
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "OBJECTID_1",
    resultOffset: String(offset),
    resultRecordCount: String(count),
    f: "json",
  });
  return `${PLAQUES_SERVICE}/query?${q.toString()}`;
}

type EsriFeature = { attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number } | null };

/** Plaques from one page of an ArcGIS query response. Features without a usable
 *  position are skipped (the app can't place them); nothing else is changed. */
export function parsePlaquesPage(json: unknown): { plaques: Plaque[]; more: boolean } {
  const page = json as { features?: EsriFeature[]; exceededTransferLimit?: boolean; error?: { message?: string } };
  if (!page || typeof page !== "object") throw new Error("The plaque service sent something unexpected.");
  if (page.error) throw new Error(`The plaque service answered: ${page.error.message ?? "error"}`);
  const plaques: Plaque[] = [];
  for (const f of page.features ?? []) {
    const a = f.attributes ?? {};
    const x = f.geometry?.x;
    const y = f.geometry?.y;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x) > 180 || Math.abs(y) > 90) continue;
    plaques.push({
      id: str(a.OBJECTID_1),
      name: str(a.Unique_Name) || str(a.Fr_Title) || "Untitled plaque",
      text: str(a.Plaque_text),
      location: str(a.Location),
      address: str(a.Street_address),
      postalCode: str(a.Postal_Code),
      municipality: str(a.Municipality_Lower_Single),
      district: str(a.Municipality_Upper_District),
      province: str(a.Province),
      country: str(a.Country),
      themes: str(a.Themes),
      frTitle: str(a.Fr_Title),
      frText: str(a.Fr_PlaqueText),
      frLocation: str(a.Fr_Location),
      streetViewUrl: safeUrl(a.SVI_URL),
      webUrl: safeUrl(a.Web_URL),
      lon: x,
      lat: y,
    });
  }
  return { plaques, more: page.exceededTransferLimit === true };
}

/** Only http(s) links are offered as buttons. */
export function safeUrl(v: unknown): string {
  const s = str(v);
  return /^https?:\/\/\S+$/i.test(s) ? s : "";
}

/** One line under a plaque's name: municipality and district, without repeats. */
export function plaqueWhere(p: Plaque): string {
  const parts = [p.municipality, p.district && p.district !== p.municipality ? p.district : "", p.country && !/canada/i.test(p.country) ? p.country : ""];
  return parts.filter(Boolean).join(", ");
}

export function plaquesGeoJSON(plaques: Plaque[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: plaques.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: { id: p.id, title: p.name },
    })),
  };
}
