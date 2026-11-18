// Everything drawn on top of the base style: satellite, the active old map,
// and the coverage outlines. Shared by the main map and the swipe-compare map.
import { GeoJSONSource, Layer, RasterDEMSource, RasterSource } from "@maplibre/maplibre-react-native";
import type { FeatureCollection } from "geojson";

import { useMemo } from "react";

import { pmtilesUrl } from "../data/packs";
import type { Overlay } from "../logic/catalog";
import { AMBER } from "../theme";

export const ESRI_TILES = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

type Props = {
  labelLayerId?: string;
  satelliteKey: string | null; // null = satellite off
  overlay: Overlay | null;
  overlayOpacity: number;
  /** pmtiles:// URL of the elevation pack, or null when hill shading is off. */
  terrainUrl?: string | null;
  coverage: Overlay[] | null; // overlays to outline, or null when coverage view is off
  onCoveragePress?: (overlayId: string) => void;
  places?: FeatureCollection | null;
  onPlacePress?: (placeId: string) => void;
  plaques?: FeatureCollection | null;
  onPlaquePress?: (plaqueId: string) => void;
};

// Ontario Heritage Trust plaques are blue and gold.
export const PLAQUE_BLUE = "#1F3A93";
export const PLAQUE_GOLD = "#D4A72C";

export function MapContent({ labelLayerId, satelliteKey, overlay, overlayOpacity, terrainUrl, coverage, onCoveragePress, places, onPlacePress, plaques, onPlaquePress }: Props) {
  const coverageData = useMemo<FeatureCollection | null>(
    () =>
      coverage && {
        type: "FeatureCollection",
        features: coverage.map((o) => ({
          type: "Feature",
          id: o.id,
          properties: { id: o.id, title: o.title, year: o.year },
          geometry: o.footprint,
        })),
      },
    [coverage],
  );

  return (
    <>
      {satelliteKey ? (
        <RasterSource
          id="satellite"
          key={`sat-${satelliteKey.slice(-6)}`}
          tiles={[`${ESRI_TILES}?token=${encodeURIComponent(satelliteKey)}`]}
          tileSize={256}
          maxzoom={19}
          attribution="Powered by Esri · Esri, Maxar, Earthstar Geographics"
        >
          <Layer type="raster" id="satellite-layer" beforeId={labelLayerId} paint={{ "raster-fade-duration": 0 }} />
        </RasterSource>
      ) : null}

      {overlay ? (
        <RasterSource
          id={`overlay-${overlay.id}`}
          key={overlay.id}
          {...(overlay.tiles
            ? { tiles: [overlay.tiles], minzoom: overlay.minzoom, maxzoom: overlay.maxzoom }
            : { url: pmtilesUrl(overlay.file!) })}
          tileSize={overlay.tile_size ?? 256}
          attribution={overlay.attribution}
        >
          <Layer
            type="raster"
            id="overlay-layer"
            beforeId={labelLayerId}
            paint={{ "raster-opacity": overlayOpacity, "raster-fade-duration": 0 }}
          />
        </RasterSource>
      ) : null}

      {terrainUrl ? (
        // Drawn over the base map and old map (under the labels) so hills show through both.
        // Elevation is stored in Mapbox terrain-RGB encoding: with a url, MapLibre React
        // Native (Android) ignores the encoding prop and always decodes it that way.
        // Only paint properties that take single values here: the Android bridge expects
        // arrays for illumination-direction, shadow and highlight colours and crashes on a
        // single value, so those keep MapLibre's defaults.
        <RasterDEMSource id="terrain" url={terrainUrl} tileSize={256} maxzoom={12}>
          <Layer
            type="hillshade"
            id="hillshade"
            beforeId={labelLayerId}
            paint={{ "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 8, 0.35, 13, 0.6] }}
          />
        </RasterDEMSource>
      ) : null}

      {coverageData ? (
        <GeoJSONSource
          id="coverage"
          data={coverageData}
          onPress={(e) => {
            const id = e.nativeEvent.features[0]?.properties?.id;
            if (id && onCoveragePress) {
              e.stopPropagation();
              onCoveragePress(String(id));
            }
          }}
        >
          <Layer type="fill" id="coverage-fill" paint={{ "fill-color": AMBER, "fill-opacity": 0.04 }} />
          <Layer type="line" id="coverage-line" paint={{ "line-color": AMBER, "line-width": 1, "line-opacity": 0.6 }} />
        </GeoJSONSource>
      ) : null}

      {plaques ? (
        <GeoJSONSource
          id="plaques"
          data={plaques}
          onPress={(e) => {
            const id = e.nativeEvent.features[0]?.properties?.id;
            if (id && onPlaquePress) {
              e.stopPropagation();
              onPlaquePress(String(id));
            }
          }}
        >
          <Layer
            type="circle"
            id="plaques-point"
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 10, 5, 15, 8],
              "circle-color": PLAQUE_BLUE,
              "circle-stroke-color": PLAQUE_GOLD,
              "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 14, 2.5],
            }}
          />
          <Layer
            type="symbol"
            id="plaques-label"
            minzoom={13}
            layout={{
              "text-field": ["get", "title"],
              "text-font": ["NotoSansMedium"],
              "text-size": 11,
              "text-offset": [0, 1.1],
              "text-anchor": "top",
              "text-optional": true,
            }}
            paint={{ "text-color": "#F2C94C", "text-halo-color": "#0E1116", "text-halo-width": 1.5 }}
          />
        </GeoJSONSource>
      ) : null}

      {places ? (
        <GeoJSONSource
          id="places"
          data={places}
          onPress={(e) => {
            const id = e.nativeEvent.features[0]?.properties?.id;
            if (id && onPlacePress) {
              e.stopPropagation();
              onPlacePress(String(id));
            }
          }}
        >
          <Layer
            type="fill"
            id="places-area"
            filter={["==", ["geometry-type"], "Polygon"]}
            paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.22 }}
          />
          <Layer
            type="line"
            id="places-area-edge"
            filter={["==", ["geometry-type"], "Polygon"]}
            paint={{ "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": 0.7, "line-dasharray": [1, 1] }}
          />
          <Layer
            type="circle"
            id="places-point"
            filter={["==", ["geometry-type"], "Point"]}
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 9],
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#0E1116",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            type="symbol"
            id="places-label"
            minzoom={11}
            layout={{
              "text-field": ["get", "title"],
              "text-font": ["NotoSansMedium"],
              "text-size": 12,
              "text-offset": [0, 1.2],
              "text-anchor": "top",
              "text-optional": true,
            }}
            paint={{ "text-color": ["get", "color"], "text-halo-color": "#0E1116", "text-halo-width": 1.5 }}
          />
        </GeoJSONSource>
      ) : null}
    </>
  );
}
