# Time Map Ontario

A personal Android app for exploring Ontario's history: old maps laid over today's
map, with a time slider. It focuses on Toronto, Hamilton and Niagara. Map data is
stored on the phone and works offline.

See [PLAN.md](PLAN.md) for the plan and [SOURCES.md](SOURCES.md) for every data
source, its licence and the attribution the app shows.

## Install on your phone

1. On the phone, open
   **https://github.com/Samsquanch-Bin/time-map-ontario/releases/tag/app-latest**
   and tap the `.apk` file.
2. When Android asks, allow your browser to "install unknown apps" (one time only).
3. Open the app and tap **Get map data**, then **Check for data** → **Download**.
   - The basemap is about 1.2 GB, so use Wi-Fi.
   - Data is saved inside the app, and after that the map works offline.

**Updating:** install the newer `.apk` the same way. Your settings and downloaded
data are kept. To get new map data, open **Settings & data** → **Check for data**.

**Satellite view:** this needs a free ArcGIS Location Platform API key from Esri.
Paste it into **Settings & data**. It is stored only on the phone.

## How it's built

Everything heavy runs on GitHub Actions, free for public repos. Nothing needs
installing on your PC.

| Workflow | What it does | Output |
|---|---|---|
| **Tests** (`ci.yml`) | Pipeline tests (pytest) and app tests and type-check | — |
| **Build Android app** (`build-app.yml`) | Expo prebuild + Gradle release build, arm64 | APK on the `app-latest` release |
| **Build map data** (`build-data.yml`) | Southern Ontario basemap extract, historical overlays, `catalog.json` | Files on the `data-latest` release |

You can run any workflow by hand: **Actions** tab → pick the workflow → **Run workflow**.

## Repository layout

```
app/                 Expo (React Native) app, TypeScript
  src/logic/         pure logic (era filter, catalogue diffing, style helpers) + tests in app/test
  src/map/           offline map style ("Night Survey" dark / "Sun" light)
  src/components/    map screen, swipe-compare, bottom-sheet panels
  plugins/           Expo config plugins (bundle fonts/sprites, optional release signing)
pipeline/            Python data pipeline
  sources/*.yaml     one manifest per data source (licence, attribution, check status)
  overlays/*.yaml    one definition per historical map overlay
  tmo_pipeline/      code; tests in pipeline/tests
schemas/             JSON Schema for catalog.json (the app's data index)
data/                researched places and settlements (coming in milestones d and e)
```

## Developing locally (optional)

**Pipeline:** unit tests need only Python. Building real data needs GDAL and the
`pmtiles` CLI.

```bash
cd pipeline && pip install -e '.[test]' && python -m pytest
```

```bash
cd pipeline && python -m tmo_pipeline sources-md   # regenerate SOURCES.md after editing sources/*.yaml
```

**App:** building an APK needs the Android SDK and JDK 17.

```bash
cd app && npm ci && npm run map-assets && npm test && npm run typecheck
```

```bash
cd app && npx expo prebuild --platform android && cd android && ./gradlew assembleRelease
```

## Rules this project follows

- **Licences:** every data source has a manifest with its licence and attribution.
  - The pipeline refuses sources without one, and the app's **Sources & credits** screen lists them.
  - A licence that has only been seen in search results is marked "unconfirmed" in both places.
- **Sample data:** anything marked `sample: true` shows a "SAMPLE DATA" label, and the release data build refuses it.
- **Privacy:**
  - No accounts, analytics or crash reporting.
  - Location is foreground-only, used only to draw the dot, never stored or sent.
  - The app works fully with location denied.
- **Precomputed data:** terrain and other heavy data is computed by the pipeline, never on the phone.

## Signing

By default, release APKs are signed with Expo's standard signing key. It is the
same on every build, so updates install over the old version. To use a private key
instead, add these repository secrets:

- `TMO_KEYSTORE_BASE64`
- `TMO_KEYSTORE_PASSWORD`
- `TMO_KEY_ALIAS`
- `TMO_KEY_PASSWORD`

Switching keys once means uninstalling the old app first.
