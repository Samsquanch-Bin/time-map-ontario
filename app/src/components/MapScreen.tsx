import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Camera, type CameraRef, Map, type TrackUserLocation, UserLocation } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { Button, FAB, IconButton, Surface, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ONLINE_STYLE } from "../config";
import { pmtilesUrl } from "../data/packs";
import { setMapStatus, startDiagnostics } from "../diagnostics";
import { usePlaces } from "../data/usePlaces";
import { placesToGeoJSON, visiblePlaces } from "../logic/places";
import { AUTO_MIN_ZOOM, chooseOverlay, hasPack, mapsHere, type Overlay, overlayAvailable } from "../logic/catalog";
import { overlaps } from "../logic/era";
import { requestForegroundLocation } from "../location";
import { buildBaseStyle, firstLabelLayerId, type MapTheme } from "../map/baseStyle";
import { useApp } from "../state/store";
import { MapContent } from "./MapContent";
import { CreditsPanel, DataPanel, LayersPanel, OverlayPanel, PlacePanel, type SheetView } from "./Panels";
import { SwipeCompare } from "./SwipeCompare";

const BASEMAP_FILE = "basemap-south.pmtiles";
const SNAP_POINTS = ["17%", "50%", "85%"]; // never covers the whole map

export function MapScreen({ mapTheme }: { mapTheme: MapTheme }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const s = useApp();
  const sheetRef = useRef<BottomSheet>(null);
  const cameraRef = useRef<CameraRef>(null);
  const compareCameraRef = useRef<CameraRef>(null);
  const [view, setView] = useState<SheetView>({ name: "layers" });
  const [track, setTrack] = useState<TrackUserLocation | undefined>(undefined);
  const [initialCamera] = useState(s.camera);

  const catalog = s.catalog;
  const basemapUrl = hasPack(catalog, s.installed, BASEMAP_FILE) ? pmtilesUrl(BASEMAP_FILE) : null;
  // Until the offline basemap is on the phone, show an online map so there's always something to see.
  const offlineStyle = useMemo(() => (basemapUrl ? buildBaseStyle(mapTheme, basemapUrl) : null), [mapTheme, basemapUrl]);
  const mapStyle = offlineStyle ?? ONLINE_STYLE[mapTheme];
  const labelLayerId = useMemo(() => (offlineStyle ? firstLabelLayerId(offlineStyle) : undefined), [offlineStyle]);
  useMemo(() => startDiagnostics(), []);

  // Old maps covering the middle of the screen, most local first; show the picked one or the best.
  const usable = useMemo(
    () => (catalog?.overlays ?? []).filter((o) => overlaps(o.era, s.era) && overlayAvailable(catalog, s.installed, o)),
    [catalog, s.era, s.installed],
  );
  const here = useMemo(() => {
    if (!s.view) return [];
    const [w, so, e, n] = s.view.bounds;
    return mapsHere(usable, [(w + e) / 2, (so + n) / 2], s.view.zoom);
  }, [usable, s.view]);
  const activeOverlay = s.oldMapOn ? chooseOverlay(here, s.activeOverlayId, s.view?.zoom ?? 0) : null;
  // A hand-picked map is let go once you move somewhere it doesn't cover
  // (but not while the camera is still flying to it).
  const flyingTo = useRef<string | null>(null);
  useEffect(() => {
    if (!s.view || !s.activeOverlayId) return;
    if (here.some((o) => o.id === s.activeOverlayId)) flyingTo.current = null;
    else if (flyingTo.current !== s.activeOverlayId) s.set({ activeOverlayId: null });
  }, [here, s.view, s.activeOverlayId]);
  const coverage = useMemo(
    () => (s.coverageVisible ? (catalog?.overlays ?? []).filter((o) => overlaps(o.era, s.era)) : null),
    [catalog, s.coverageVisible, s.era],
  );
  const allPlaces = usePlaces();
  const shownPlaces = useMemo(
    () => (s.placesVisible ? visiblePlaces(allPlaces, s.era, s.hiddenCategories) : []),
    [allPlaces, s.placesVisible, s.era, s.hiddenCategories],
  );
  const placesGeoJSON = useMemo(() => (shownPlaces.length ? placesToGeoJSON(shownPlaces) : null), [shownPlaces]);
  const comparing = s.compare && !!activeOverlay;
  // While comparing, the "Today" side is satellite whenever there's a key for it.
  const satelliteKey = (s.basemap === "satellite" || comparing) && s.esriKey ? s.esriKey : null;

  const go = useCallback((v: SheetView) => {
    setView(v);
    sheetRef.current?.snapToIndex(1);
  }, []);

  // Fly to a map, close enough in that it's drawn there.
  const zoomTo = (o: Overlay) => {
    flyingTo.current = o.id;
    const [w, so, e, n] = o.bounds;
    const inside = (w + e) / 2;
    const mid = (so + n) / 2;
    const big = Math.max(e - w, n - so) > 0.15;
    if (big) cameraRef.current?.flyTo({ center: [inside, mid], zoom: Math.max(o.minzoom, AUTO_MIN_ZOOM), duration: 900 });
    else cameraRef.current?.fitBounds([w, so, e, n], { padding: { top: 40, right: 40, bottom: 200, left: 40 }, duration: 800 });
  };

  const onLocate = async () => {
    const ok = await requestForegroundLocation();
    if (!ok) {
      Alert.alert(
        "Location is off",
        "Everything else works without it. To see where you are, allow location for Time Map Ontario.",
        [{ text: "Not now" }, { text: "Open settings", onPress: () => Linking.openSettings() }],
      );
      return;
    }
    s.set({ showUser: true });
    setTrack("default");
  };

  const overlayForView = view.name === "overlay" ? catalog?.overlays.find((o) => o.id === view.id) : undefined;
  const placeForView = view.name === "place" ? allPlaces.find((p) => p.id === view.id) : undefined;

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <Map
        style={styles.fill}
        mapStyle={mapStyle}
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        logo={false}
        compassPosition={{ top: insets.top + 64, right: 12 }}
        tintColor={theme.colors.primary}
        onWillStartLoadingMap={() => setMapStatus(`loading ${offlineStyle ? "offline basemap" : "online preview map"}`)}
        onDidFinishLoadingMap={() => setMapStatus(`${offlineStyle ? "offline basemap" : "online preview map"} loaded`)}
        onDidFailLoadingMap={() => setMapStatus(`FAILED to load ${offlineStyle ? "offline basemap" : "online preview map"}`)}
        onRegionIsChanging={(e) => {
          if (!comparing) return;
          const { center, zoom, bearing, pitch } = e.nativeEvent;
          compareCameraRef.current?.jumpTo({ center, zoom, bearing, pitch });
        }}
        onRegionDidChange={(e) => {
          const { center, zoom, bearing, pitch, userInteraction, bounds } = e.nativeEvent;
          if (comparing) compareCameraRef.current?.jumpTo({ center, zoom, bearing, pitch });
          s.set({ view: { bounds: bounds as [number, number, number, number], zoom } });
          if (userInteraction) {
            flyingTo.current = null;
            s.set({ camera: { center: center as [number, number], zoom } });
          }
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: initialCamera.center, zoom: initialCamera.zoom }}
          trackUserLocation={track}
          onTrackUserLocationChange={(e) => setTrack(e.nativeEvent.trackUserLocation ?? undefined)}
        />
        <MapContent
          labelLayerId={labelLayerId}
          satelliteKey={satelliteKey}
          overlay={comparing ? null : activeOverlay}
          overlayOpacity={s.overlayOpacity}
          coverage={coverage}
          onCoveragePress={(id) => go({ name: "overlay", id })}
          places={placesGeoJSON}
          onPlacePress={(id) => go({ name: "place", id })}
        />
        {s.showUser ? <UserLocation accuracy heading /> : null}
      </Map>

      {comparing && activeOverlay ? (
        <SwipeCompare ref={compareCameraRef} mapStyle={mapStyle as never} labelLayerId={labelLayerId} overlay={activeOverlay} initial={s.camera} />
      ) : null}

      {!basemapUrl ? (
        <Surface style={[styles.banner, { top: insets.top + 8, backgroundColor: theme.colors.surface }]} elevation={3}>
          <Text variant="titleSmall">Online preview map</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Download the map data (about 1.2 GB, use Wi-Fi) to get the full map, old maps and places, working offline.
          </Text>
          <Button mode="contained" icon="download" onPress={() => go({ name: "data" })} style={{ alignSelf: "flex-start", marginTop: 6 }}>
            Download map data
          </Button>
        </Surface>
      ) : null}

      <View style={[styles.fabs, { top: insets.top + 120 }]}>
        <FAB
          icon={track ? "crosshairs-gps" : "crosshairs"}
          accessibilityLabel="Show my location"
          onPress={onLocate}
          style={styles.fab}
          variant={track ? "primary" : "surface"}
        />
        {activeOverlay ? (
          <FAB
            icon="arrow-split-vertical"
            accessibilityLabel={comparing ? "Stop comparing" : "Swipe to compare with today"}
            onPress={() => s.set({ compare: !s.compare })}
            style={styles.fab}
            variant={comparing ? "primary" : "surface"}
          />
        ) : null}
      </View>

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.outline, width: 48 }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheet}>
          {view.name !== "layers" ? (
            <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={() => setView({ name: "layers" })} style={styles.back} />
          ) : null}
          {view.name === "layers" ? <LayersPanel go={go} placeCount={shownPlaces.length} here={here} shown={activeOverlay} /> : null}
          {view.name === "place" && placeForView ? (
            <PlacePanel
              place={placeForView}
              onZoom={() => {
                cameraRef.current?.flyTo({ center: [placeForView.lon, placeForView.lat], zoom: placeForView.precision === "exact" ? 15 : 13, duration: 900 });
                sheetRef.current?.snapToIndex(0);
              }}
            />
          ) : null}
          {view.name === "overlay" && overlayForView ? (
            <OverlayPanel
              overlay={overlayForView}
              isShown={activeOverlay?.id === overlayForView.id}
              onShow={() => {
                s.set({ activeOverlayId: overlayForView.id, oldMapOn: true, compare: false });
                if (!here.some((o) => o.id === overlayForView.id)) zoomTo(overlayForView);
                sheetRef.current?.snapToIndex(0);
              }}
              onCompare={() => {
                s.set({ activeOverlayId: overlayForView.id, oldMapOn: true, compare: true });
                if (!here.some((o) => o.id === overlayForView.id)) zoomTo(overlayForView);
                sheetRef.current?.snapToIndex(0);
              }}
              onZoom={() => {
                zoomTo(overlayForView);
                sheetRef.current?.snapToIndex(0);
              }}
            />
          ) : null}
          {view.name === "data" ? <DataPanel /> : null}
          {view.name === "credits" ? <CreditsPanel /> : null}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  banner: { position: "absolute", left: 12, right: 76, padding: 12, borderRadius: 12, gap: 4 },
  fabs: { position: "absolute", right: 12, gap: 12 },
  fab: {},
  sheet: { paddingHorizontal: 16, paddingBottom: 48, gap: 8 },
  back: { marginLeft: -8, marginBottom: -4 },
});
