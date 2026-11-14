// Swipe-compare: a second map, clipped to the left of a draggable divider, shows
// the old map at full strength; the main map underneath shows today's map.
// The second map is non-interactive and follows the main map's camera.
import { Camera, type CameraRef, Map, type StyleSpecification } from "@maplibre/maplibre-react-native";
import { forwardRef, useMemo, useState } from "react";
import { PanResponder, StyleSheet, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, useTheme } from "react-native-paper";

import type { Overlay } from "../logic/catalog";
import { MapContent } from "./MapContent";

type Props = {
  mapStyle: StyleSpecification;
  labelLayerId?: string;
  overlay: Overlay;
  initial: { center: [number, number]; zoom: number };
};

export const SwipeCompare = forwardRef<CameraRef, Props>(function SwipeCompare({ mapStyle, labelLayerId, overlay, initial }, cameraRef) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const [x, setX] = useState(width / 2);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (e) => setX(Math.max(24, Math.min(width - 24, e.nativeEvent.pageX))),
      }),
    [width],
  );

  return (
    <>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: x, overflow: "hidden" }]}>
        <Map
          // A SurfaceView ignores the parent's clipping on Android and would cover the
          // whole screen; a TextureView is clipped to the left of the divider.
          androidView="texture"
          style={{ width, height: "100%" }}
          mapStyle={mapStyle}
          attribution={false}
          logo={false}
          compass={false}
          dragPan={false}
          touchZoom={false}
          touchRotate={false}
          touchPitch={false}
        >
          <Camera ref={cameraRef} initialViewState={{ center: initial.center, zoom: initial.zoom }} />
          <MapContent labelLayerId={labelLayerId} satelliteKey={null} overlay={overlay} overlayOpacity={1} coverage={null} />
        </Map>
      </View>
      <View style={[styles.divider, { left: x - 1, backgroundColor: theme.colors.primary }]} pointerEvents="none" />
      <View
        {...responder.panHandlers}
        style={[styles.handle, { left: x - 28, backgroundColor: theme.colors.primary }]}
        accessibilityLabel="Drag to compare the old map with today"
      >
        <MaterialCommunityIcons name="arrow-split-vertical" size={28} color={theme.colors.onPrimary} />
      </View>
      <View pointerEvents="none" style={[styles.tag, { left: 12, backgroundColor: theme.colors.primary }]}>
        <Text style={{ color: theme.colors.onPrimary, fontWeight: "700" }}>{overlay.year}</Text>
      </View>
      <View pointerEvents="none" style={[styles.tag, { right: 12, backgroundColor: theme.colors.surface }]}>
        <Text style={{ color: theme.colors.onSurface, fontWeight: "700" }}>Today</Text>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  divider: { position: "absolute", top: 0, bottom: 0, width: 2 },
  handle: { position: "absolute", top: "40%", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 6 },
  tag: { position: "absolute", top: 56, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
});
