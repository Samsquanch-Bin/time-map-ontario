// Everything drawn on top of the base style: satellite, the active old map,
// and the coverage outlines. Shared by the main map and the swipe-compare map.
import { GeoJSONSource, Images, Layer, RasterDEMSource, RasterSource, VectorSource } from "@maplibre/maplibre-react-native";
import { byKind } from "../logic/trails";
import { MONUMENT_KINDS } from "../logic/monuments";
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
  /** Highlight parks and green spaces from the offline basemap at this opacity (null = off). */
  parksOpacity?: number | null;
  /** pmtiles:// URL of the monuments & battlefields pack when switched on. */
  monumentsUrl?: string | null;
  onMonumentPress?: (props: Record<string, unknown>, at: [number, number]) => void;
  /** pmtiles:// URL of the trails pack when trails are switched on. */
  trailsUrl?: string | null;
  trailsOpacity?: number;
  onTrailPress?: (props: Record<string, unknown>) => void;
  /** Your pins, plus the one just dropped (properties.draft) if any. */
  myPins?: FeatureCollection | null;
  onMyPinPress?: (pinId: string) => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RED_PIN = require("../../assets/red-pin.png");

// Parks and green spaces (OpenStreetMap kinds in the basemap's landuse layer), in a bright green
// that stands out on satellite and old maps.
export const GREEN_SPACE_KINDS = [
  "park", "national_park", "nature_reserve", "protected_area", "garden", "village_green",
  "playground", "recreation_ground", "dog_park", "common",
];
export const GREEN_SPACE_COLOR = "#00E676";

// Ontario Heritage Trust plaques are blue and gold.
export const PLAQUE_BLUE = "#1F3A93";
export const PLAQUE_GOLD = "#D4A72C";

export function MapContent({ labelLayerId, satelliteKey, overlay, overlayOpacity, terrainUrl, coverage, onCoveragePress, places, onPlacePress, plaques, onPlaquePress, myPins, onMyPinPress, trailsUrl, trailsOpacity = 0.9, onTrailPress, parksOpacity, monumentsUrl, onMonumentPress }: Props) {
  const parksBeforeId = trailsUrl
    ? "paths-casing"
    : plaques
      ? "plaques-point"
      : places
        ? "places-area"
        : myPins && myPins.features.length
          ? "my-pins-drop"
          : undefined;
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

      {parksOpacity != null ? (
        <>
          {/* keep the green under trails, plaques, places and pins whichever is switched on first */}
          <Layer
            type="fill"
            id="greenspace-fill"
            beforeId={parksBeforeId}
            source="protomaps"
            source-layer="landuse"
            filter={["in", ["get", "kind"], ["literal", GREEN_SPACE_KINDS]] as never}
            paint={{ "fill-color": GREEN_SPACE_COLOR, "fill-opacity": 0.55 * parksOpacity }}
          />
          <Layer
            type="line"
            id="greenspace-edge"
            beforeId={parksBeforeId}
            source="protomaps"
            source-layer="landuse"
            filter={["in", ["get", "kind"], ["literal", GREEN_SPACE_KINDS]] as never}
            paint={{ "line-color": "#00C853", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 15, 2.5], "line-opacity": parksOpacity }}
          />
        </>
      ) : null}

      {trailsUrl ? (
        <VectorSource
          id="trails"
          url={trailsUrl}
          onPress={(e) => {
            const f = e.nativeEvent.features[0];
            if (f && onTrailPress) {
              e.stopPropagation();
              onTrailPress((f.properties ?? {}) as Record<string, unknown>);
            }
          }}
        >
          <Layer
            type="line"
            id="paths-casing"
            source-layer="paths"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#0E1116", "line-opacity": 0.75 * trailsOpacity, "line-width": byKind((k) => k.width + 2, 3) as never }}
          />
          <Layer
            type="line"
            id="paths-line"
            source-layer="paths"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": byKind((k) => k.color, "#ffffff") as never,
              "line-opacity": trailsOpacity,
              "line-width": byKind((k) => k.width, 1.5) as never,
              "line-dasharray": [2, 1.5],
            }}
          />
          <Layer
            type="line"
            id="trails-casing"
            source-layer="trails"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#0E1116",
              "line-opacity": 0.8 * trailsOpacity,
              "line-width": ["interpolate", ["linear"], ["zoom"], 7, 2.5, 12, byKind((k) => k.width + 2.5, 4), 16, byKind((k) => k.width + 4, 6)] as never,
            }}
          />
          <Layer
            type="line"
            id="trails-line"
            source-layer="trails"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": byKind((k) => k.color, "#FFE135") as never,
              "line-opacity": trailsOpacity,
              "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.2, 12, byKind((k) => k.width, 3), 16, byKind((k) => k.width + 2, 5)] as never,
            }}
          />
          <Layer
            type="symbol"
            id="trails-label"
            source-layer="trails"
            minzoom={12}
            layout={{
              "symbol-placement": "line",
              "text-field": ["get", "name"],
              "text-font": ["NotoSansMedium"],
              "text-size": 12,
              "text-optional": true,
            }}
            paint={{ "text-color": byKind((k) => k.color, "#FFE135") as never, "text-halo-color": "#0E1116", "text-halo-width": 2, "text-opacity": trailsOpacity }}
          />
          <Layer
            type="symbol"
            id="paths-label"
            source-layer="paths"
            minzoom={14}
            filter={["has", "name"]}
            layout={{ "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["NotoSansMedium"], "text-size": 11, "text-optional": true }}
            paint={{ "text-color": "#E8FFE5", "text-halo-color": "#0E1116", "text-halo-width": 2, "text-opacity": trailsOpacity }}
          />
        </VectorSource>
      ) : null}

      {monumentsUrl ? (
        <VectorSource
          id="monuments"
          url={monumentsUrl}
          onPress={(e) => {
            const f = e.nativeEvent.features.find((x) => x.geometry?.type === "Point") ?? e.nativeEvent.features[0];
            if (f && onMonumentPress) {
              e.stopPropagation();
              const at = (f.geometry?.type === "Point" ? f.geometry.coordinates : e.nativeEvent.lngLat) as [number, number];
              onMonumentPress((f.properties ?? {}) as Record<string, unknown>, at);
            }
          }}
        >
          <Layer
            type="fill"
            id="battlefields-fill"
            source-layer="battlefields"
            paint={{ "fill-color": "#E53935", "fill-opacity": 0.16 }}
          />
          <Layer
            type="line"
            id="battlefields-edge"
            source-layer="battlefields"
            paint={{ "line-color": "#E53935", "line-width": 2.5, "line-dasharray": [3, 2] }}
          />
          <Layer
            type="circle"
            id="monuments-point"
            source-layer="monuments"
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3, 11, 5.5, 15, 8],
              "circle-color": ["match", ["get", "kind"], ...MONUMENT_KINDS.flatMap((k) => [k.id, k.color]), "#E9DCC0"] as never,
              "circle-stroke-color": ["match", ["get", "kind"], ...MONUMENT_KINDS.flatMap((k) => [k.id, k.stroke]), "#3B2A14"] as never,
              "circle-stroke-width": 2.5,
            }}
          />
          <Layer
            type="symbol"
            id="monuments-label"
            source-layer="monuments"
            minzoom={12}
            filter={["has", "name"]}
            layout={{ "text-field": ["get", "name"], "text-font": ["NotoSansMedium"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }}
            paint={{ "text-color": "#F3E6C8", "text-halo-color": "#0E1116", "text-halo-width": 1.5 }}
          />
        </VectorSource>
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

      <Images images={{ "red-pin": RED_PIN }} />
      {myPins && myPins.features.length ? (
        <GeoJSONSource
          id="my-pins"
          data={myPins}
          onPress={(e) => {
            const id = e.nativeEvent.features[0]?.properties?.id;
            if (id && id !== "draft" && onMyPinPress) {
              e.stopPropagation();
              onMyPinPress(String(id));
            }
          }}
        >
          <Layer
            type="circle"
            id="my-pins-drop"
            filter={["==", ["get", "draft"], true]}
            paint={{ "circle-radius": 14, "circle-color": "#D93025", "circle-opacity": 0.25, "circle-stroke-color": "#D93025", "circle-stroke-width": 1 }}
          />
          <Layer
            type="symbol"
            id="my-pins-icon"
            layout={{
              "icon-image": "red-pin",
              "icon-anchor": "bottom",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "text-field": ["get", "title"],
              "text-font": ["NotoSansMedium"],
              "text-size": 12,
              "text-anchor": "top",
              "text-offset": [0, 0.3],
              "text-optional": true,
            }}
            paint={{ "text-color": "#FF6B5E", "text-halo-color": "#0E1116", "text-halo-width": 1.5 }}
          />
        </GeoJSONSource>
      ) : null}
    </>
  );
}
