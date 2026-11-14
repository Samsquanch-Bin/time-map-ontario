// Builds the MapLibre style for the offline basemap ("Night Survey" look).
import { DARK, LIGHT, layers, type Flavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";

import { styleWithFonts } from "../logic/style";

export type MapTheme = "dark" | "light";

const FONTS = { regular: "NotoSansRegular", bold: "NotoSansMedium", italic: "NotoSansItalic" };

// Night Survey: blue-black land, deep navy water, quiet roads, readable labels.
const NIGHT_SURVEY: Flavor = {
  ...DARK,
  ...FONTS,
  background: "#0E1116",
  earth: "#141A22",
  water: "#0B1A2B",
  park_a: "#14211C",
  park_b: "#14231D",
  wood_a: "#151F1A",
  wood_b: "#151F1A",
  scrub_a: "#161D1B",
  scrub_b: "#161D1B",
  buildings: "#10151C",
  minor_a: "#2A323D",
  minor_b: "#252C36",
  major: "#323B47",
  highway: "#3C4655",
  link: "#323B47",
  railway: "#2B313A",
  boundaries: "#5B6374",
  roads_label_minor: "#6E7887",
  roads_label_major: "#8590A0",
  city_label: "#A4AEBC",
  city_label_halo: "#0E1116",
  subplace_label: "#7C8796",
  ocean_label: "#6D86A3",
};

// Field light: muted so colourful old maps stand out; used in bright sun.
const FIELD_LIGHT: Flavor = {
  ...LIGHT,
  ...FONTS,
  earth: "#ECEAE5",
  background: "#DAD7D0",
  water: "#B9CDDA",
  park_a: "#DCE5D8",
  park_b: "#D6E2D2",
};

export const BACKGROUND = { dark: NIGHT_SURVEY.background, light: FIELD_LIGHT.background };

/**
 * @param pmtilesUrl pmtiles://file:///… URL of the downloaded basemap, or null if
 *   it isn't downloaded yet (then only a plain background is drawn).
 */
export function buildBaseStyle(theme: MapTheme, pmtilesUrl: string | null): StyleSpecification {
  const flavor = theme === "dark" ? NIGHT_SURVEY : FIELD_LIGHT;
  if (!pmtilesUrl) {
    return {
      version: 8,
      sources: {},
      layers: [{ id: "background", type: "background", paint: { "background-color": flavor.background } }],
    };
  }
  const style = {
    version: 8,
    glyphs: "asset://fonts/{fontstack}/{range}.pbf",
    sprite: `asset://sprites/${theme}`,
    sources: {
      protomaps: {
        type: "vector",
        url: pmtilesUrl,
        attribution: "© OpenStreetMap contributors · Protomaps",
      },
    },
    layers: layers("protomaps", flavor, { lang: "en" }),
  };
  return styleWithFonts(style, FONTS.regular) as unknown as StyleSpecification;
}

/** Id of the first label layer: overlays and satellite are inserted below it so
 * modern place names stay readable on top. */
export function firstLabelLayerId(style: StyleSpecification): string | undefined {
  return style.layers.find((l) => l.type === "symbol")?.id;
}
