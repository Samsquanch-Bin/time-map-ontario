// Everything drawn on top of the base style: satellite, the active old map,
// and the coverage outlines. Shared by the main map and the swipe-compare map.
import { GeoJSONSource, Layer, RasterSource } from "@maplibre/maplibre-react-native";
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
  coverage: Overlay[] | null; // overlays to outline, or null when coverage view is off
  onCoveragePress?: (overlayId: string) => void;
  places?: FeatureCollection | null;
  onPlacePress?: (placeId: string) => void;
};

export function MapContent({ labelLayerId, satelliteKey, overlay, overlayOpacity, coverage, onCoveragePress, places, onPlacePress }: Props) {
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
