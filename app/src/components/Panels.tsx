// Bottom-sheet panels: layers, overlay details, settings/data, attributions.
import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button, Divider, List, ProgressBar, SegmentedButtons, Switch, Text, TextInput, useTheme } from "react-native-paper";

import { fetchRemoteCatalog, freeSpaceBytes, type Progress, syncPacks } from "../data/packs";
import { type Catalog, formatBytes, hasPack, type Overlay, packsToDownload, totalBytes } from "../logic/catalog";
import { formatRange, overlaps } from "../logic/era";
import { useApp } from "../state/store";
import { EraSlider } from "./EraSlider";
import { OpacitySlider } from "./OpacitySlider";


export type SheetView = { name: "layers" } | { name: "overlay"; id: string } | { name: "data" } | { name: "credits" };

export function LayersPanel({ go }: { go: (v: SheetView) => void }) {
  const theme = useTheme();
  const s = useApp();
  const catalog = s.catalog;
  const overlays = (catalog?.overlays ?? []).filter((o) => overlaps(o.era, s.era));
  const hidden = (catalog?.overlays.length ?? 0) - overlays.length;
  const active = catalog?.overlays.find((o) => o.id === s.activeOverlayId) ?? null;
  const activeHidden = active && !overlaps(active.era, s.era);

  return (
    <View style={styles.gap}>
      <EraSlider value={s.era} onChange={(era) => s.set({ era })} />

      {active ? (
        <View style={[styles.card, { borderColor: theme.colors.primary }]}>
          <View style={styles.row}>
            <Text variant="titleSmall" style={{ flex: 1 }}>
              {active.title}
            </Text>
            <Button compact onPress={() => go({ name: "overlay", id: active.id })}>
              Details
            </Button>
          </View>
          {activeHidden ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Hidden: {active.year} is outside the selected years.</Text>
          ) : (
            <OpacitySlider value={s.overlayOpacity} onChange={(overlayOpacity) => s.set({ overlayOpacity })} />
          )}
        </View>
      ) : null}

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
          Old maps
        </Text>
        <Text>Coverage</Text>
        <Switch value={s.coverageVisible} onValueChange={(coverageVisible) => s.set({ coverageVisible })} />
      </View>
      {!catalog ? (
        <Text style={{ color: theme.colors.onSurfaceVariant }}>No map data on this phone yet. Open Settings & data to download it.</Text>
      ) : overlays.length === 0 ? (
        <Text style={{ color: theme.colors.onSurfaceVariant }}>No old maps in {formatRange(s.era)}. Widen the years above.</Text>
      ) : (
        overlays.map((o) => (
          <List.Item
            key={o.id}
            title={o.title}
            description={`${o.year}${o.sample ? " · SAMPLE DATA" : ""}`}
            onPress={() => s.set({ activeOverlayId: s.activeOverlayId === o.id ? null : o.id, compare: false })}
            left={(p) => <List.Icon {...p} icon={s.activeOverlayId === o.id ? "checkbox-marked" : "checkbox-blank-outline"} color={theme.colors.primary} />}
            right={(p) => <List.Icon {...p} icon="information-outline" />}
            style={styles.item}
          />
        ))
      )}
      {hidden > 0 ? <Text style={{ color: theme.colors.onSurfaceVariant }}>{hidden} more outside the selected years.</Text> : null}

      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Coming next: terrain, trails, places of interest and Indigenous settlements.
      </Text>

      <Divider />
      <List.Item title="Settings & data" left={(p) => <List.Icon {...p} icon="cog-outline" />} onPress={() => go({ name: "data" })} style={styles.item} />
      <List.Item title="Sources & credits" left={(p) => <List.Icon {...p} icon="book-open-outline" />} onPress={() => go({ name: "credits" })} style={styles.item} />
    </View>
  );
}

export function OverlayPanel({ overlay, onCompare, onZoom }: { overlay: Overlay; onCompare: () => void; onZoom: () => void }) {
  const theme = useTheme();
  const s = useApp();
  const isActive = s.activeOverlayId === overlay.id;
  return (
    <View style={styles.gap}>
      <Text variant="headlineSmall">{overlay.title}</Text>
      <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
        {formatRange(overlay.era)}
        {overlay.sample ? "  ·  SAMPLE DATA" : ""}
      </Text>
      {overlay.description ? <Text>{overlay.description}</Text> : null}
      <View style={styles.row}>
        <Button mode={isActive ? "outlined" : "contained"} onPress={() => s.set({ activeOverlayId: isActive ? null : overlay.id })}>
          {isActive ? "Hide" : "Show"}
        </Button>
        <Button mode="outlined" icon="arrow-split-vertical" onPress={onCompare}>
          Compare
        </Button>
        <Button mode="text" icon="crosshairs" onPress={onZoom}>
          Go there
        </Button>
      </View>
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
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Privacy: no accounts, no analytics. Your location is only used to draw the dot and never leaves the phone.
      </Text>
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
  item: { minHeight: 52, paddingHorizontal: 0 },
  credit: { gap: 2, paddingVertical: 4 },
});
