# Time Map Ontario: Plan v2 (personal use)

*Revised 2026-11-14 from your answers · awaiting your final OK · no code written yet*

## What changed from v1
- **Personal use only.** No Play Store, no permission emails, no domain, no outside reviewers.
  - Licences that allow personal and non-commercial use are now acceptable.
  - Every source is still recorded in `SOURCES.md` and credited in the app.
- **Focus area: Toronto (GTA), Hamilton and Niagara**, roughly 10,000 km². It gets full detail: terrain, historical maps and researched places. The rest of Ontario gets a coarser basemap and terrain.
- **Map data lives on your phone** (Galaxy S25 Ultra) and works offline.
  - There is no hosting. GitHub builds the data and the app.
  - Esri satellite is the only part that needs a data connection.
- **Nothing to install on your Windows PC.** All processing and builds run in GitHub Actions on your repo `Samsquanch-Bin/time-map-ontario`.
- **Places of interest are researched by Claude in this session, not by a paid API pipeline.**
  - Every entry has source links and a "researched by Claude — check sources" label.
  - Entries show up right away; there is no approval step (your choice 3b).
- **Treaty areas are dropped.** In their place is a layer of **Indigenous settlements and longhouse village sites** in the focus area, placed as precisely as public sources give them.
- **Look: "Night Survey"**, dark-first with an amber accent, plus a light variant for bright sun.

---

## 1. How it works

```
GitHub repo (public)
├── app/            Expo / React Native app (TypeScript)
├── pipeline/       Python: fetch → process → validate → package
├── data/places/    one Markdown file per researched place (sources in front matter)
├── data/settlements/  Indigenous settlement records (GeoJSON + sources)
└── .github/workflows/
    ├── build-app.yml    → signed APK attached to a GitHub Release
    └── build-data.yml   → data packs (.pmtiles + JSON) attached to a GitHub Release

Your phone
1. Download the APK from the Releases page and install it ("install unknown apps" once).
2. In the app: Settings → Data packs → Download (Wi-Fi). Packs are stored in app storage.
3. The app reads packs offline via pmtiles://file://…  ·  Esri satellite streams online.
```

- **Why GitHub Actions:** this cloud session can't reach most government data sites and has too little disk. GitHub's runners can, and they're free for public repos. I write and test the pipeline here on small sample files, and the full runs happen on GitHub.
- **Updates:** to get a new app version or new data, download the new release. Your settings are kept, because every APK is signed with the same key, which is stored as a GitHub Actions secret.
- **Framework:** Expo (React Native) with `@maplibre/maplibre-react-native` v11, which supports PMTiles, raster tiles and offline use. The code can be reused for an iPhone version later. That will need a Mac or Expo's cloud build service, and probably a $99/yr Apple developer account to keep the app installed long-term.
- **Data packs and estimated sizes:**

  | Pack | Contents | Size |
  |---|---|---|
  | `basemap` | OSM via Protomaps. Focus area z0–15, rest of Ontario z0–12. | ~0.5–1 GB |
  | `terrain` | Hillshade, contours and elevation | ~1–1.3 GB |
  | `trails` | Trails | ~50–150 MB |
  | `history` | Historical map overlays | ~0.3–1 GB |
  | `places` | Places of interest and settlements (JSON) | < 5 MB |

  Total is about 2–3.5 GB, well within your phone's storage. Sizes are estimates; I measure them in the first builds.

## 2. Features (v1)

1. **Basemap.** A dark, muted map style, with a Standard/Satellite toggle. Satellite is Esri World Imagery through your own free ArcGIS Location Platform key (you create the account; I give you the steps). You paste the key into the app's Settings; it is stored only on your phone, never in the repo.
2. **Historical overlays.**
   - Each map has an opacity slider and swipe-compare.
   - A **coverage view** shows where overlays exist.
   - Each overlay shows its source, year and an accuracy note, worked out from how well its reference points line up.
   - Candidates for the focus area (licence checked per map before use):
     - **Brock University "Early Niagara" maps**, e.g. Niagara Peninsula 1826. Already georeferenced, marked public domain.
     - **OCUL historical topographic maps** (about 1906–1930s) for the Toronto, Hamilton and Niagara sheets. Already georeferenced, public domain.
     - **Toronto Public Library public-domain scans:**
       - Boulton's Atlas of Toronto, 1858.
       - 1870s county atlases for York, Wentworth (Hamilton) and Lincoln & Welland.
       - I georeference these myself, matching control points against OSM, and show you a side-by-side check.
     - **Tremaine county maps, about 1859–62** (York, Peel, Halton, Wentworth, Lincoln, Welland). I use public-domain scans from TPL, LAC or Wikimedia and georeference them myself.
     - **David Rumsey items** for the region. The licence is non-commercial, so they're fine here.
3. **Era slider.** Filters overlays, places and settlements by date.
   - Proposed eras: before 1650 · 1650–1763 · 1763–1841 · 1841–1867 · 1867–1914 · 1914 onward.
   - It sits in the bottom sheet so you can use it one-handed.
4. **Trails.** From OpenStreetMap, which includes the Bruce Trail and Waterfront Trail as mapped routes. Ontario Trail Network data can be added later for names.
5. **Terrain.**
   - **Hillshade** sits under the old maps.
   - **Contours** adapt to zoom level: 50 m when zoomed out, down to 5 m at street level in the focus area.
   - **Elevation readout** in metres for the GPS dot and any point you tap.
   - **Sources:**
     - NRCan HRDEM lidar (1–2 m) in the focus area, blended over NRCan's 30 m MRDEM so seams don't show.
     - Ontario's Lake Ontario topo-bathymetric DEM along the Hamilton–Niagara-on-the-Lake and Scarborough–Port Hope shores.
     - Coarser 30 m data outside the focus area, with an in-app note there.
   - Everything is precomputed on GitHub. Your phone only reads tiles.
6. **Places of interest.**
   - Pins open a bottom-sheet story with sources.
   - Topics: **early settlers and mills, lost villages, Indigenous history, old battles** (War of 1812, the 1866 Fenian Raid).
   - Each entry is researched from retrieved sources: Wikipedia and Wikidata, Parks Canada, municipal and conservation-authority pages, and public-domain county histories. It records its sources, dates and how precise the location is. If sources are thin, the entry says so. Nothing is filled in from memory.
7. **Indigenous settlements and longhouse villages.**
   - Village sites in the focus area, placed as precisely as public sources give them. Examples to research:
     - Seneca villages at Teiaiagon on the Humber and Ganatsekwyagon on the Rouge.
     - Village sites north of Toronto such as Parsons and Draper.
     - Neutral (Attawandaron) villages around Hamilton and Niagara.
     - The reconstructed longhouse village at Crawford Lake.
   - Each record carries its source, period, Nation, and a **location precision label** ("exact per source", "approximate", "general area"). Where a source only gives a general area, it is drawn as a shaded area, not a pin.
   - A "report a correction" link stays in the app. It opens an email to you, since you're the only user.
   - Restricted sources, such as Ontario's licensed archaeological sites database, are never used.
   - Because the repo is public, this compiled list is publicly visible too. It contains only data that is already public.
8. **"You are here".**
   - Foreground location only, requested when you first tap the locate button.
   - The dot plus a recenter button.
   - Location never leaves the phone and is never saved.
   - The app works fully if you deny permission.

**Privacy:**
- No accounts, analytics or crash reporting.
- Settings and last view are stored only on the phone.
- The only network calls are pack downloads from GitHub and Esri satellite tiles.

## 3. Look: "Night Survey"
- **Dark UI and basemap:** near-black UI with a dark blue-grey, low-saturation basemap.
- **Accent:** a single amber accent (#FFB300) for the active layer, slider and buttons.
- **Old maps stand out:** shown full-colour with a thin amber outline. The coverage view uses amber dashed outlines.
- **Terrain:** hillshade at low opacity, contours thin and faint.
- **Light variant:** a high-contrast light theme for sun. You can switch to it outdoors or have it follow the system.
- **Layout:** large touch targets (≥ 48 dp) and Material 3 components (React Native Paper). The map fills the screen. All layer controls are in a bottom sheet that never covers the whole map.

## 4. Milestones (each ends with an APK you install)

| # | Milestone | What you'll see |
|---|---|---|
| 0 | Setup | Repo scaffold, both GitHub workflows, `SOURCES.md` v1, signing key secret |
| a | Map core | Basemap (focus area plus Ontario), Esri satellite, first real overlays (Brock Niagara 1826 + an OCUL topo) with opacity, swipe-compare and coverage view, era slider, GPS dot, data-pack download |
| b | Terrain | Hillshade, adaptive contours, elevation readout, coarse-data note |
| c | Trails | OSM trails layer |
| d | Places | First ~30–50 researched places in the focus area, then more in batches |
| e | Settlements | Indigenous settlement and longhouse layer |
| f | Polish | Light theme, more historical overlays (TPL and Tremaine), accessibility, attribution screen |

## 5. Cost
- **$0** in total: GitHub Actions and Releases are free for public repos, and Esri has a free tier.
- No Play fee, hosting or AI API charges.

## 6. Assumptions and risks
- **[A1]** MapLibre on Android reads `.pmtiles` files from local phone storage. I verify this in Milestone a. Fallback: bundle packs as MBTiles, or serve them from a tiny in-app file reader.
- **[A2]** Esri's free tier can be used without a payment method, so it can't bill you. I confirm this before you sign up. Fallback: EOX Sentinel-2 (free, no signup, blurry up close).
- **[A3]** Georeferencing the TPL and Tremaine maps by hand is slow and inexact. Each one gets a measured accuracy note, and I show you a before/after check.
- **[A4]** Some licence pages couldn't be opened from this session. I re-check each source when the GitHub pipeline first fetches it, and record the result in `SOURCES.md`.
- **[A5]** Swipe-compare uses two synced map views. If it's sluggish, a "spyglass" lens is the fallback.
- **[A6]** Android developer verification (global in 2027) may later make sideloading harder. Google offers a free "limited distribution" account (up to 20 devices) and USB installs stay exempt, so this is manageable. I'll flag it when it applies.
- **[A7]** Since nothing is human-approved (choice 3b), every place entry carries the "researched by Claude — check sources" label. Sample or test data is labelled "SAMPLE" and can't appear in a release build; a test enforces this.
