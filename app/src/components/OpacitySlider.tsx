// Simple 0–100% opacity slider (react-native-paper has no slider).
import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const THUMB = 28;

export function OpacitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [draft, setDraft] = useState<number | null>(null);
  const start = useRef(value);
  const shown = draft ?? value;
  const clamp = (v: number) => Math.max(0.05, Math.min(1, v));

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const v = clamp(e.nativeEvent.locationX / Math.max(1, width));
          start.current = v;
          setDraft(v);
        },
        onPanResponderMove: (_e, g) => setDraft(clamp(start.current + g.dx / Math.max(1, width))),
        onPanResponderRelease: () =>
          setDraft((d) => {
            if (d != null) onChange(Math.round(d * 100) / 100);
            return null;
          }),
      }),
    [width, onChange],
  );

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Opacity</Text>
      <View
        style={styles.track}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`Old map opacity ${Math.round(shown * 100)} percent`}
      >
        <View style={[styles.rail, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={[styles.fill, { width: shown * width, backgroundColor: theme.colors.primary }]} />
        <View
          pointerEvents="none"
          style={[styles.thumb, { left: shown * width - THUMB / 2, backgroundColor: theme.colors.primary, borderColor: theme.colors.surface }]}
        />
      </View>
      <Text style={styles.value}>{Math.round(shown * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { width: 56 },
  value: { width: 44, textAlign: "right" },
  track: { flex: 1, height: 44, justifyContent: "center" },
  rail: { height: 4, borderRadius: 2 },
  fill: { position: "absolute", height: 6, borderRadius: 3 },
  thumb: { position: "absolute", width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3 },
});
