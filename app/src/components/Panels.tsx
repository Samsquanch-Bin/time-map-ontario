// Bottom-sheet panels: layers, overlay details, settings/data, attributions.
import { useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Button, Chip, Divider, IconButton, List, ProgressBar, SegmentedButtons, Switch, Text, TextInput, useTheme } from "react-native-paper";

import { fetchRemoteCatalog, freeSpaceBytes, type Progress, syncPacks } from "../data/packs";
import { useDiagnostics } from "../diagnostics";
import { AUTO_MIN_ZOOM, type Catalog, formatBytes, hasPack, type Overlay, packsToDownload, totalBytes } from "../logic/catalog";
import { formatRange } from "../logic/era";
import { CATEGORIES, type Place, precisionText } from "../logic/places";
import { type Plaque, PLAQUES_CREDIT, PLAQUES_MAP_URL, PLAQUES_TERMS, plaqueWhere } from "../logic/plaques";
import { ERA_MAX, ERA_MIN, ISSUES_EMAIL_SUBJECT } from "../config";
import { useApp } from "../state/store";
import { EraSlider } from "./EraSlider";
import { PLAQUE_GOLD } from "./MapContent";
import { OpacitySlider } from "./OpacitySlider";


export type SheetView =
  | { name: "layers" }
  | { name: "overlay"; id: string }
  | { name: "place"; id: string }
  | { name: "plaque"; id: string }
  | { name: "data" }
  | { name: "credits" };

export type PlaquesState = { count: number; busy: boolean; error: string; refresh: () => void };

type LayersProps = {
  go: (v: SheetView) => void;
  placeCount: number;
  /** Maps covering the centre of the screen at this zoom, most local first. */
  here: Overlay[];
  /** The map being drawn now (picked by hand or chosen automatically), if any. */
  shown: Overlay | null;
  plaques: PlaquesState;
};

export function LayersPanel({ go, placeCount, here, shown, plaques }: LayersProps) {
  const theme = useTheme();
  const s = useApp();
  const [more, setMore] = useState(false);
  const catalog = s.catalog;
  const zoom = s.view?.zoom ?? 0;
  const idx = shown ? here.findIndex((o) => o.id === shown.id) : -1;
  const allYears = s.era[0] <= ERA_MIN && s.era[1] >= ERA_MAX;

  const locked = !!s.lockedOverlayId && shown?.id === s.lockedOverlayId;
  // Picking a map while one is locked moves the lock to the new map.
  const pick = (id: string) =>
    s.set({ activeOverlayId: id, oldMapOn: true, compare: false, ...(s.lockedOverlayId ? { lockedOverlayId: id } : {}) });
  const step = (d: number) => {
    if (here.length === 0) return;
    pick(here[(Math.max(idx, 0) + d + here.length) % here.length].id);
  };

  let headline: string;
  let detail: string;
  if (!catalog) {
    headline = "No map data yet";
    detail = "Download the map data to see old maps.";
  } else if (!s.oldMapOn) {
    headline = "Old maps are off";
    detail = "Turn them on to see the old map for wherever you zoom in.";
  } else if (shown) {
    headline = shown.title;
    detail = [
      `${shown.year}`,
      locked ? "locked" : "",
      shown.tiles ? "needs internet" : "",
      idx < 0 ? "not on this spot" : zoom < shown.minzoom ? "zoom in to see it" : here.length > 1 ? `${idx + 1} of ${here.length} maps here` : "only map here",
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (zoom < AUTO_MIN_ZOOM) {
    headline = "Zoom in on a town";
    detail = "The best old map for that spot appears by itself.";
  } else {
    headline = "No old map of this spot";
    detail = allYears ? "Try a town centre nearby." : `None from ${formatRange(s.era)}. Widen the years under More.`;
  }

  return (
    <View style={styles.gap}>
      <View style={[styles.card, { borderColor: theme.colors.primary }]}>
        <View style={styles.nowRow}>
          <IconButton icon="chevron-left" accessibilityLabel="Previous map here" disabled={here.length < 2 || !s.oldMapOn} onPress={() => step(-1)} />
          <Pressable style={{ flex: 1 }} disabled={!shown} onPress={() => shown && go({ name: "overlay", id: shown.id })}>
            <Text variant="titleMedium" numberOfLines={2}>
              {headline}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {detail}
            </Text>
          </Pressable>
          {shown && s.oldMapOn ? (
            <IconButton
              icon={locked ? "lock" : "lock-open-variant-outline"}
              iconColor={locked ? theme.colors.primary : theme.colors.onSurfaceVariant}
              mode={locked ? "contained-tonal" : undefined}
              accessibilityLabel={locked ? "Unlock this map" : "Lock this map"}
              onPress={() =>
                s.set(locked ? { lockedOverlayId: null, activeOverlayId: null } : { lockedOverlayId: shown.id, activeOverlayId: shown.id })
              }
            />
          ) : null}
          <IconButton icon="chevron-right" accessibilityLabel="Next map here" disabled={here.length < 2 || !s.oldMapOn} onPress={() => step(1)} />
        </View>
        {!catalog ? (
          <Button mode="contained" icon="download" onPress={() => go({ name: "data" })} style={{ alignSelf: "flex-start" }}>
            Download map data
          </Button>
        ) : null}
      </View>

      {catalog ? (
        <View style={styles.row}>
          <Text variant="titleSmall" style={{ flex: 1 }}>
            Old maps
          </Text>
          {s.activeOverlayId && !s.lockedOverlayId ? (
            <Button compact onPress={() => s.set({ activeOverlayId: null })}>
              Back to automatic
            </Button>
          ) : null}
          <Switch value={s.oldMapOn} onValueChange={(oldMapOn) => s.set({ oldMapOn, compare: false })} />
        </View>
      ) : null}
      {shown && s.oldMapOn ? (
        <View style={styles.row}>
          <List.Icon icon={locked ? "lock" : "lock-open-variant-outline"} color={locked ? theme.colors.primary : theme.colors.onSurfaceVariant} />
          <View style={{ flex: 1 }}>
            <Text variant="titleSmall">Lock this map</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {locked ? "Stays on wherever you move. Turn off to go back to automatic." : "Keep this map on instead of switching as you move."}
            </Text>
          </View>
          <Switch
            value={locked}
            onValueChange={(on) =>
              s.set(on ? { lockedOverlayId: shown.id, activeOverlayId: shown.id } : { lockedOverlayId: null, activeOverlayId: null })
            }
          />
        </View>
      ) : null}
      {shown ? <OpacitySlider value={s.overlayOpacity} onChange={(overlayOpacity) => s.set({ overlayOpacity })} /> : null}

      <Text variant="titleSmall">Base map</Text>
      <SegmentedButtons
        value={s.basemap}
        onValueChange={(v) => {
          if (v === "satellite" && !s.esriKey) go({ name: "data" });
          s.set({ basemap: v as "standard" | "satellite" });
        }}
        buttons={[
          { value: "standard", label: "Standard", icon: "map-outline" },
          { value: "satellite", label: "Satellite", icon: "satellite-variant" },
        ]}
      />
      {s.basemap === "satellite" && !s.esriKey ? (
        <Text style={{ color: theme.colors.error }}>Satellite needs your Esri key (Settings & data).</Text>
      ) : null}

      <View style={styles.row}>
        <Text variant="titleSmall" style={{ flex: 1 }}>
          Places of interest
        </Text>
        <Switch value={s.placesVisible} onValueChange={(placesVisible) => s.set({ placesVisible })} />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text variant="titleSmall">Historical plaques</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {plaques.busy
              ? "Getting plaques from the Ontario Heritage Trust…"
              : s.plaquesVisible && plaques.count
                ? `${plaques.count} Ontario Heritage Trust plaques on this phone`
                : "Ontario Heritage Trust provincial plaques (needs internet the first time)"}
          </Text>
        </View>
        <Switch value={s.plaquesVisible} onValueChange={(plaquesVisible) => s.set({ plaquesVisible })} />
      </View>
      {plaques.error ? <Text style={{ color: theme.colors.error }}>{plaques.error}</Text> : null}
      {s.plaquesVisible && !plaques.busy ? (
        <Button mode="text" icon="refresh" onPress={plaques.refresh} style={{ alignSelf: "flex-start", marginTop: -8 }}>
          {plaques.count ? `Update plaques${s.plaquesSavedAt ? ` (saved ${s.plaquesSavedAt.slice(0, 10)})` : ""}` : "Get plaques"}
        </Button>
      ) : null}

      <Divider />
      <List.Item
        title="More"
        description={allYears ? "Years, place types, every map here" : `Years: ${formatRange(s.era)}`}
        left={(p) => <List.Icon {...p} icon="tune-variant" />}
        right={(p) => <List.Icon {...p} icon={more ? "chevron-up" : "chevron-down"} />}
        onPress={() => setMore(!more)}
        style={styles.item}
      />
      {more ? (
        <View style={styles.gap}>
          <Text variant="titleSmall">Only maps and places from these years</Text>
          <EraSlider value={s.era} onChange={(era) => s.set({ era })} />

          {s.placesVisible ? (
            <>
              <Text variant="titleSmall">Place types</Text>
              <View style={styles.row}>
                {CATEGORIES.map((c) => {
                  const on = !s.hiddenCategories.includes(c.id);
                  return (
                    <Chip
                      key={c.id}
                      icon={c.icon}
                      selected={on}
                      showSelectedCheck={false}
                      selectedColor={on ? c.color : undefined}
                      onPress={() =>
                        s.set({ hiddenCategories: on ? [...s.hiddenCategories, c.id] : s.hiddenCategories.filter((x) => x !== c.id) })
                      }
                      style={{ minHeight: 40 }}
                    >
                      {c.label}
                    </Chip>
                  );
                })}
              </View>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {placeCount > 0 ? `${placeCount} place(s) shown for these years.` : "No researched places on this phone yet."}
              </Text>
            </>
          ) : null}

          <View style={styles.row}>
            <Text variant="titleSmall" style={{ flex: 1 }}>
              Outline where old maps exist
            </Text>
            <Switch value={s.coverageVisible} onValueChange={(coverageVisible) => s.set({ coverageVisible })} />
          </View>

          {here.length > 0 ? (
            <>
              <Text variant="titleSmall">Every map of this spot</Text>
              {here.map((o) => (
                <List.Item
                  key={o.id}
                  title={o.title}
                  description={`${o.year}${o.tiles ? " · needs internet" : ""}${o.sample ? " · SAMPLE DATA" : ""}`}
                  onPress={() => pick(o.id)}
                  left={(p) => (
                    <List.Icon {...p} icon={shown?.id === o.id ? "radiobox-marked" : "radiobox-blank"} color={theme.colors.primary} />
                  )}
                  right={(p) => <IconButton {...p} icon="information-outline" onPress={() => go({ name: "overlay", id: o.id })} />}
                  style={styles.item}
                />
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      <List.Item title="Settings & data" left={(p) => <List.Icon {...p} icon="cog-outline" />} onPress={() => go({ name: "data" })} style={styles.item} />
      <List.Item title="Sources & credits" left={(p) => <List.Icon {...p} icon="book-open-outline" />} onPress={() => go({ name: "credits" })} style={styles.item} />
    </View>
  );
}

export function OverlayPanel({ overlay, isShown, onShow, onCompare, onZoom }: { overlay: Overlay; isShown: boolean; onShow: () => void; onCompare: () => void; onZoom: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.gap}>
      <Text variant="headlineSmall">{overlay.title}</Text>
      <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
        {formatRange(overlay.era)}
        {overlay.sample ? "  ·  SAMPLE DATA" : ""}
      </Text>
      {overlay.description ? <Text>{overlay.description}</Text> : null}
      <View style={styles.row}>
        {isShown ? null : (
          <Button mode="contained" onPress={onShow}>
            Show
          </Button>
        )}
        <Button mode="outlined" icon="arrow-split-vertical" onPress={onCompare}>
          Compare
        </Button>
        <Button mode="text" icon="crosshairs" onPress={onZoom}>
          Go there
        </Button>
      </View>
      {overlay.tiles ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Online only: shown straight from the holder's map server, so it needs a data connection and isn't stored on the phone.
        </Text>
      ) : null}
      <Text variant="titleSmall">How accurate is it?</Text>
      <Text>{overlay.accuracy_note}</Text>
      <Text variant="titleSmall">Source</Text>
      <Text>{overlay.attribution}</Text>
      <Text>
        Licence: {overlay.licence}
        {overlay.licence_status === "unconfirmed" ? " (not yet confirmed on the source's own page)" : ""}
      </Text>
      {overlay.source_item_licence ? <Text>Source page says: {stripHtml(overlay.source_item_licence)}</Text> : null}
      {overlay.source_url ? (
        <Button mode="text" icon="open-in-new" onPress={() => Linking.openURL(overlay.source_url!)}>
          Open source
        </Button>
      ) : null}
    </View>
  );
}

export function PlaquePanel({ plaque, onZoom }: { plaque: Plaque; onZoom: () => void }) {
  const theme = useTheme();
  const [fr, setFr] = useState(false);
  const hasFr = !!(plaque.frTitle || plaque.frText);
  const title = fr && plaque.frTitle ? plaque.frTitle : plaque.name;
  const text = fr && plaque.frText ? plaque.frText : plaque.text;
  const location = fr && plaque.frLocation ? plaque.frLocation : plaque.location;
  const where = plaqueWhere(plaque);
  const address = [plaque.address, plaque.postalCode].filter(Boolean).join(" ");
  return (
    <View style={styles.gap}>
      <Text variant="labelLarge" style={{ color: PLAQUE_GOLD }}>
        ONTARIO HERITAGE TRUST PLAQUE
      </Text>
      <Text variant="headlineSmall">{title}</Text>
      {where ? (
        <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {where}
        </Text>
      ) : null}
      {hasFr ? (
        <SegmentedButtons
          value={fr ? "fr" : "en"}
          onValueChange={(v) => setFr(v === "fr")}
          buttons={[
            { value: "en", label: "English" },
            { value: "fr", label: "Français" },
          ]}
          style={{ alignSelf: "flex-start" }}
        />
      ) : null}
      {text ? <Text style={styles.story}>{text}</Text> : <Text style={{ color: theme.colors.onSurfaceVariant }}>No plaque text in the Trust's data.</Text>}
      {location ? (
        <>
          <Text variant="titleSmall">{fr ? "Emplacement" : "Location"}</Text>
          <Text>{location}</Text>
        </>
      ) : null}
      {address ? (
        <>
          <Text variant="titleSmall">Address</Text>
          <Text>{address}</Text>
        </>
      ) : null}
      {plaque.themes ? (
        <>
          <Text variant="titleSmall">Themes</Text>
          <Text>{plaque.themes}</Text>
        </>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        <Button mode="text" icon="crosshairs" onPress={onZoom}>
          Go there
        </Button>
        {plaque.webUrl ? (
          <Button mode="text" icon="open-in-new" onPress={() => Linking.openURL(plaque.webUrl)}>
            Website
          </Button>
        ) : null}
        {plaque.streetViewUrl ? (
          <Button mode="text" icon="google-street-view" onPress={() => Linking.openURL(plaque.streetViewUrl)}>
            Street View
          </Button>
        ) : null}
      </View>
      <View style={[styles.note, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="bodySmall">Source: {PLAQUES_CREDIT}. {PLAQUES_TERMS}</Text>
      </View>
    </View>
  );
}

export function PlacePanel({ place, onZoom }: { place: Place; onZoom: () => void }) {
  const theme = useTheme();
  const cat = CATEGORIES.find((c) => c.id === place.category);
  const mail = `mailto:?subject=${encodeURIComponent(`${ISSUES_EMAIL_SUBJECT}: ${place.id}`)}&body=${encodeURIComponent(
    `Place: ${place.title} (${place.id})\nWhat's wrong:\n`,
  )}`;
  return (
    <View style={styles.gap}>
      <Text variant="headlineSmall">{place.title}</Text>
      <Text variant="titleMedium" style={{ color: cat?.color }}>
        {cat?.label} · {place.date_label || formatRange([place.start, place.end])}
        {place.sample ? "  ·  SAMPLE DATA" : ""}
      </Text>
      {place.nation ? <Text variant="titleSmall">{place.nation}</Text> : null}
      <Text style={styles.story}>{place.story}</Text>
      <View style={[styles.note, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="bodySmall">Researched by Claude from the sources below and not reviewed by a person. Check the sources before relying on it.</Text>
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {precisionText(place)}
      </Text>
      <Button mode="text" icon="crosshairs" onPress={onZoom} style={{ alignSelf: "flex-start" }}>
        Go there
      </Button>
      <Text variant="titleSmall">Sources</Text>
      {place.sources.map((src, i) => (
        <Text key={i} style={{ color: theme.colors.primary }} onPress={() => Linking.openURL(src.url)}>
          [{i + 1}] {src.title}
          {src.licence ? ` (${src.licence})` : ""} · retrieved {src.retrieved}
        </Text>
      ))}
      <Button mode="text" icon="email-outline" onPress={() => Linking.openURL(mail)} style={{ alignSelf: "flex-start" }}>
        Report a correction
      </Button>
    </View>
  );
}

export function DataPanel() {
  const theme = useTheme();
  const s = useApp();
  const [remote, setRemote] = useState<Catalog | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(false);
  const [key, setKey] = useState(s.esriKey);

  const check = async () => {
    setError("");
    setStatus("Checking GitHub…");
    try {
      const c = await fetchRemoteCatalog();
      setRemote(c);
      const todo = packsToDownload(c, s.installed);
      const free = await freeSpaceBytes();
      setStatus(
        todo.length === 0
          ? "Everything is up to date."
          : `${todo.length} file(s) to download, ${formatBytes(totalBytes(todo))}` + (free != null ? ` · ${formatBytes(free)} free on phone` : ""),
      );
    } catch (e) {
      setStatus("");
      setError(String((e as Error).message ?? e));
    }
  };

  const download = async () => {
    if (!remote) return;
    setBusy(true);
    cancelRef.current = false;
    setError("");
    try {
      const installed = await syncPacks(remote, s.installed, setProgress, () => cancelRef.current);
      const complete = packsToDownload(remote, installed).length === 0;
      // Only switch to the new catalogue once all its packs are on the phone.
      s.set(complete ? { installed, catalog: remote } : { installed });
      setStatus(complete ? "Download complete." : "Stopped. Tap Download to continue.");
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const basemapReady = hasPack(s.catalog, s.installed, "basemap-south.pmtiles");

  return (
    <View style={styles.gap}>
      <Text variant="headlineSmall">Settings & data</Text>

      <Text variant="titleSmall">Map data on this phone</Text>
      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        {s.catalog
          ? `Data from ${s.catalog.generated_at.slice(0, 10)} · ${basemapReady ? "basemap ready" : "basemap missing"} · ${s.catalog.overlays.length} old map(s)`
          : "Nothing downloaded yet. The basemap is about 1.2 GB — use Wi-Fi."}
      </Text>
      <View style={styles.row}>
        <Button mode="contained-tonal" icon="refresh" onPress={check} disabled={busy}>
          Check for data
        </Button>
        {remote && packsToDownload(remote, s.installed).length > 0 ? (
          <Button mode="contained" icon="download" onPress={download} disabled={busy}>
            Download
          </Button>
        ) : null}
      </View>
      {status ? <Text>{status}</Text> : null}
      {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}
      {progress ? (
        <View style={styles.gap}>
          <Text>
            {progress.file} ({progress.index}/{progress.count}) · {formatBytes(progress.written)} of {formatBytes(progress.total)}
          </Text>
          <ProgressBar progress={progress.total ? progress.written / progress.total : 0} />
          <Button onPress={() => (cancelRef.current = true)}>Stop after this file</Button>
        </View>
      ) : null}

      <Divider />
      <Text variant="titleSmall">Satellite (Esri)</Text>
      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        Paste your ArcGIS Location Platform API key. It is stored only on this phone. Satellite images need a data connection.
      </Text>
      <TextInput
        mode="outlined"
        label="Esri API key"
        value={key}
        onChangeText={setKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.row}>
        <Button mode="contained-tonal" onPress={() => s.set({ esriKey: key.trim() })} disabled={key.trim() === s.esriKey}>
          Save key
        </Button>
        {s.esriKey ? (
          <Button
            onPress={() => {
              setKey("");
              s.set({ esriKey: "", basemap: "standard" });
            }}
          >
            Remove key
          </Button>
        ) : null}
      </View>

      <Divider />
      <Text variant="titleSmall">Appearance</Text>
      <SegmentedButtons
        value={s.themePref}
        onValueChange={(v) => s.set({ themePref: v as "system" | "dark" | "light" })}
        buttons={[
          { value: "dark", label: "Night", icon: "weather-night" },
          { value: "light", label: "Sun", icon: "white-balance-sunny" },
          { value: "system", label: "Auto" },
        ]}
      />
      <Divider />
      <Diagnostics />
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Privacy: no accounts, no analytics. Your location is only used to draw the dot and never leaves the phone.
      </Text>
    </View>
  );
}

function Diagnostics() {
  const theme = useTheme();
  const s = useApp();
  const d = useDiagnostics();
  const files = Object.keys(s.installed);
  return (
    <View style={styles.gap}>
      <Text variant="titleSmall">Diagnostics</Text>
      <Text variant="bodySmall">Map: {d.mapStatus}</Text>
      <Text variant="bodySmall">Files on phone: {files.length ? files.join(", ") : "none"}</Text>
      {d.entries
        .filter((e) => e.level !== "info")
        .slice(0, 8)
        .map((e, i) => (
          <Text key={i} variant="bodySmall" style={{ color: e.level === "error" ? theme.colors.error : theme.colors.onSurfaceVariant }}>
            {e.time} {e.level}: {e.message}
          </Text>
        ))}
    </View>
  );
}

export function CreditsPanel() {
  const theme = useTheme();
  const catalog = useApp((s) => s.catalog);
  return (
    <View style={styles.gap}>
      <Text variant="headlineSmall">Sources & credits</Text>
      {!catalog ? <Text>Credits appear here once map data is downloaded.</Text> : null}
      {catalog?.attributions.map((a) => (
        <View key={a.source_id} style={styles.credit}>
          <Text variant="titleSmall">{a.name}</Text>
          <Text>{a.text}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            {a.licence}
            {a.licence_status === "unconfirmed" ? " · licence not yet confirmed on the source's own page" : ""}
          </Text>
          {a.homepage ? (
            <Text style={{ color: theme.colors.primary }} onPress={() => Linking.openURL(a.homepage!)}>
              {a.homepage}
            </Text>
          ) : null}
        </View>
      ))}
      <View style={styles.credit}>
        <Text variant="titleSmall">Ontario Provincial Plaques (Ontario Heritage Trust)</Text>
        <Text>Plaque names, text, locations and links: {PLAQUES_CREDIT}.</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          Trust's terms: personal, non-commercial use with credit; no redistribution. The app fetches the plaques from the Trust's own map service onto this phone only.
        </Text>
        <Text style={{ color: theme.colors.primary }} onPress={() => Linking.openURL(PLAQUES_MAP_URL)}>
          {PLAQUES_MAP_URL}
        </Text>
      </View>
    </View>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  card: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 6 },
  nowRow: { flexDirection: "row", alignItems: "center", marginHorizontal: -8 },
  item: { minHeight: 52, paddingHorizontal: 0 },
  credit: { gap: 2, paddingVertical: 4 },
  story: { fontSize: 16, lineHeight: 24 },
  note: { borderRadius: 6, padding: 8 },
});
