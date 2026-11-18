// Search box over the map: coordinates, researched places and old maps (on the
// phone), and place names (online, OpenStreetMap Nominatim, when you press Search).
import { useMemo, useState } from "react";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, List, Searchbar, Surface, Text, useTheme } from "react-native-paper";

import { type GeoResult, searchPlaces } from "../data/geocode";
import type { Overlay } from "../logic/catalog";
import type { Place } from "../logic/places";
import { type Plaque, plaqueWhere } from "../logic/plaques";
import { type LonLat, matchNames, parseCoordinates } from "../logic/search";

export type SearchTarget = { center: LonLat; zoom?: number; bbox?: [number, number, number, number]; label: string };

type Row = { key: string; title: string; detail: string; icon: string; target: SearchTarget };

type Props = {
  top: number;
  places: Place[];
  plaques: Plaque[];
  overlays: Overlay[];
  onGo: (t: SearchTarget) => void;
  onClear: () => void;
  /** Whether the results list is open; the map closes it when tapped. */
  open: boolean;
  setOpen: (open: boolean) => void;
};

export function SearchBar({ top, places, plaques, overlays, onGo, onClear, open, setOpen }: Props) {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [online, setOnline] = useState<GeoResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const local = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    const coord = parseCoordinates(text);
    if (coord) {
      const label = `${coord[1].toFixed(5)}, ${coord[0].toFixed(5)}`;
      rows.push({ key: "coord", title: label, detail: "Go to these coordinates", icon: "crosshairs-gps", target: { center: coord, zoom: 17, label } });
      return rows;
    }
    for (const p of matchNames(places, text, (p) => p.title, 4)) {
      rows.push({
        key: `place-${p.id}`,
        title: p.title,
        detail: "Researched place",
        icon: "map-marker-star-outline",
        target: { center: [p.lon, p.lat], zoom: p.precision === "exact" ? 16 : 14, label: p.title },
      });
    }
    for (const p of matchNames(plaques, text, (p) => p.name, 4)) {
      const where = plaqueWhere(p);
      rows.push({
        key: `plaque-${p.id}`,
        title: p.name,
        detail: `Historical plaque${where ? ` · ${where}` : ""}`,
        icon: "sign-text",
        target: { center: [p.lon, p.lat], zoom: 17, label: p.name },
      });
    }
    for (const o of matchNames(overlays, text, (o) => o.title, 3)) {
      const [w, s, e, n] = o.bounds;
      rows.push({
        key: `map-${o.id}`,
        title: o.title,
        detail: "Old map",
        icon: "map-clock-outline",
        target: { center: [(w + e) / 2, (s + n) / 2], bbox: o.bounds, zoom: Math.max(o.minzoom, 12), label: o.title },
      });
    }
    return rows;
  }, [text, places, plaques, overlays]);

  const onlineRows: Row[] = (online ?? []).map((r) => ({
    key: r.id,
    title: r.name,
    detail: r.detail,
    icon: "map-search-outline",
    target: { center: r.center, bbox: r.bbox, zoom: 16, label: r.name },
  }));

  const runOnline = async () => {
    const q = text.trim();
    if (!q || parseCoordinates(q)) return;
    setBusy(true);
    setError(null);
    try {
      setOnline(await searchPlaces(q));
    } catch (e) {
      setOnline(null);
      setError(e instanceof Error && /network/i.test(e.message) ? "No internet: place names need a connection." : String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const choose = (row: Row) => {
    Keyboard.dismiss();
    setOpen(false);
    setText(row.target.label);
    onGo(row.target);
  };

  const rows = [...local, ...onlineRows];
  const showList = open && text.trim().length > 0;

  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <Searchbar
        placeholder="Search a place or paste coordinates"
        value={text}
        onChangeText={(t) => {
          setText(t);
          setOpen(true);
          setOnline(null);
          setError(null);
        }}
        onFocus={() => setOpen(true)}
        onSubmitEditing={() => {
          setOpen(true);
          runOnline();
        }}
        returnKeyType="search"
        onClearIconPress={() => {
          setText("");
          setOnline(null);
          onClear();
        }}
        elevation={3}
        style={styles.bar}
      />
      {showList ? (
        <Surface style={[styles.list, { backgroundColor: theme.colors.surface }]} elevation={3}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {rows.map((r) => (
              <List.Item
                key={r.key}
                title={r.title}
                description={r.detail}
                descriptionNumberOfLines={1}
                left={(p) => <List.Icon {...p} icon={r.icon} />}
                onPress={() => choose(r)}
              />
            ))}
            {busy ? <ActivityIndicator style={{ margin: 12 }} /> : null}
            {error ? <Text style={[styles.note, { color: theme.colors.error }]}>{error}</Text> : null}
            {!busy && online === null && !parseCoordinates(text) ? (
              <List.Item
                title={`Search “${text.trim()}”`}
                description="Parks, streets, towns… (online, OpenStreetMap)"
                left={(p) => <List.Icon {...p} icon="magnify" />}
                onPress={runOnline}
              />
            ) : null}
            {online !== null && online.length === 0 && !busy ? <Text style={styles.note}>No places found by that name.</Text> : null}
          </ScrollView>
        </Surface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12 },
  bar: { borderRadius: 28 },
  list: { marginTop: 6, borderRadius: 12, maxHeight: 360, overflow: "hidden" },
  note: { padding: 12 },
});
