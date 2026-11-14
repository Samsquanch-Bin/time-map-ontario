# Data sources

*Generated from `pipeline/sources/*.yaml` by `python -m tmo_pipeline sources-md`. Do not edit by hand.*

This app is for personal use. Every dataset it shows is listed here with its licence
and the attribution text the app displays. **Licence check** says how sure we are:

- **confirmed**: the licence was read on the provider's own page or repository.
- **unconfirmed**: only seen via search summaries (many official sites are blocked
  from the build session); it is re-checked when the GitHub data build fetches it.
- **rejected**: must not be used.


| Source | Used for | Licence | Licence check | Attribution shown in app |
|---|---|---|---|---|
| [Brock University Map, Data & GIS Library — Early Niagara georeferenced maps](https://brocku.ca/library/collections-research-resources/maps-data-gis/) | overlays | Public domain (per item metadata "public domain / No restrictions") | unconfirmed (2026-11-14) | Map scan: Library and Archives Canada; georeferencing: Brock University Map, Data & GIS Library |
| [Esri World Imagery (satellite / aerial basemap)](https://developers.arcgis.com/) | satellite | [Esri ArcGIS Location Platform terms (free tier; requires the user's own API key)](https://www.esri.com/en-us/legal/terms/full-master-agreement) | unconfirmed (2026-11-14) | Powered by Esri · Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community |
| [OpenStreetMap data](https://www.openstreetmap.org) | basemap, trails | [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright) | confirmed (2026-11-14) | © OpenStreetMap contributors |
| [Noto Sans glyphs and map sprites (basemaps-assets)](https://github.com/protomaps/basemaps-assets) | basemap | [Fonts SIL Open Font License 1.1; sprites derived from MIT-licensed tangrams/icons](https://github.com/protomaps/basemaps-assets#license) | confirmed (2026-11-14) | Noto Sans (SIL OFL 1.1); icons from tangrams/icons (MIT) |
| [Protomaps Basemap (tiles schema, daily OSM builds, map style)](https://github.com/protomaps/basemaps) | basemap | [Style code BSD-3-Clause; style design CC0; tiles are an ODbL Produced Work of OpenStreetMap](https://github.com/protomaps/basemaps/blob/main/LICENSE.md) | confirmed (2026-11-14) | Protomaps |

## Notes per source

### Brock University Map, Data & GIS Library — Early Niagara georeferenced maps (`brock_early_niagara`)

- Provider: Brock University Map, Data & GIS Library (scans from Library and Archives Canada National Map Collection)
- Data: https://terra.library.brocku.ca/arcgis/rest/services/EarlyNiagara
- Licence check: **unconfirmed** — Search summary of item metadata (terra.library.brocku.ca blocked from build session); re-checked per item by the data build
- Terms notes: The pipeline downloads each item's iteminfo (licenseInfo / accessInformation) and stores it next to the overlay; the build log prints it so the per-item licence can be confirmed.

### Esri World Imagery (satellite / aerial basemap) (`esri_world_imagery`)

- Provider: Esri, via ArcGIS Location Platform
- Data: https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer
- Licence check: **unconfirmed** — Search summaries of developers.arcgis.com pricing and Esri community answers; Esri pages blocked from build session
- Check notes: Confirm free tier needs no payment method before the user signs up.
- Terms notes: Streamed online only, never stored in a data pack. The API key is entered by the user on the phone and is never committed to the repository. Free tier reported as 2M basemap tiles/month (search summary).

### OpenStreetMap data (`openstreetmap`)

- Provider: OpenStreetMap contributors / OpenStreetMap Foundation
- Licence check: **confirmed** — Licence text well established; OSMF attribution guideline read via search summary (osmfoundation.org blocked from build session)
- Terms notes: Tiles built from OSM are treated as an ODbL "Produced Work". Attribution must be visible on the map. The build recipe (pipeline/) is public so the derived data can be reproduced. tile.openstreetmap.org is never used.

### Noto Sans glyphs and map sprites (basemaps-assets) (`protomaps_assets`)

- Provider: Protomaps / Noto Project Authors / tangrams icons
- Licence check: **confirmed** — Read README.md and fonts/OFL.txt in the GitHub repository

### Protomaps Basemap (tiles schema, daily OSM builds, map style) (`protomaps_basemap`)

- Provider: Protomaps
- Data: https://build.protomaps.com/
- Licence check: **confirmed** — Read LICENSE.md and docs in the GitHub repositories
- Terms notes: Docs ask users not to hotlink the build bucket; we copy a regional extract once per data build into our own GitHub release.
