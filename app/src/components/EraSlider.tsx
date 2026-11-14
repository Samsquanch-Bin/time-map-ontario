// Two-thumb year range slider plus era chips. Big touch targets for one-handed use.
import { useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";

import { ERA_MAX, ERA_MIN } from "../config";
import { ERAS, formatRange, matchingEra, normalise, type Range } from "../logic/era";

const THUMB = 28;

export function EraSlider({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [draft, setDraft] = useState<Range | null>(null);
  const shown = draft ?? value;
  const startRef = useRef<Range>(value);
  const thumbRef = useRef<0 | 1>(0);

  const toX = (year: number) => ((year - ERA_MIN) / (ERA_MAX - ERA_MIN)) * width;
  const toYear = (x: number) => ERA_MIN + (x / Math.max(1, width)) * (ERA_MAX - ERA_MIN);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const x = e.nativeEvent.locationX;
          const cur = draft ?? value;
          // grab whichever thumb is closer to the finger
          thumbRef.current = Math.abs(x - toX(cur[0])) <= Math.abs(x - toX(cur[1])) ? 0 : 1;
          startRef.current = cur;
        },
        onPanResponderMove: (_e, g) => {
          const s = startRef.current;
          const moved = toYear(toX(s[thumbRef.current]) + g.dx);
          const next: Range = thumbRef.current === 0 ? [Math.min(moved, s[1]), s[1]] : [s[0], Math.max(moved, s[0])];
          setDraft(normalise(next, ERA_MIN, ERA_MAX));
        },
        onPanResponderRelease: () => {
          setDraft((d) => {
            if (d) onChange(d);
            return null;
          });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, value, draft],
  );

  const active = matchingEra(shown, ERA_MAX);
  const all = shown[0] === ERA_MIN && shown[1] === ERA_MAX;

  return (
    <View>
      <View style={styles.header}>
        <Text variant="titleSmall">Time period</Text>
        <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
          {all ? "All years" : formatRange(shown)}
        </Text>
      </View>
      <View
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`Years ${formatRange(shown)}`}
      >
        <View style={[styles.rail, { backgroundColor: theme.colors.outlineVariant }]} />
        {width > 0 ? (
          <>
            <View
              style={[
                styles.fill,
                { left: toX(shown[0]), width: Math.max(2, toX(shown[1]) - toX(shown[0])), backgroundColor: theme.colors.primary },
              ]}
            />
            {[0, 1].map((i) => (
              <View
                key={i}
                pointerEvents="none"
                style={[styles.thumb, { left: toX(shown[i]) - THUMB / 2, backgroundColor: theme.colors.primary, borderColor: theme.colors.surface }]}
              />
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.chips}>
        <Chip compact selected={all} showSelectedCheck={false} onPress={() => onChange([ERA_MIN, ERA_MAX])} style={styles.chip}>
          All
        </Chip>
        {ERAS.map((era) => (
          <Chip
            key={era.id}
            compact
            selected={active?.id === era.id}
            showSelectedCheck={false}
            onPress={() => onChange(normalise(era.range, ERA_MIN, ERA_MAX))}
            style={styles.chip}
          >
            {era.label}
          </Chip>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  track: { height: 48, justifyContent: "center", marginHorizontal: THUMB / 2 },
  rail: { height: 4, borderRadius: 2 },
  fill: { position: "absolute", height: 6, borderRadius: 3 },
  thumb: { position: "absolute", width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { minHeight: 36 },
});
