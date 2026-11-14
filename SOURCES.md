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
| [Brock University Map, Data & GIS Library — Early Niagara georeferenced maps](https://brocku.ca/library/collections-research-resources/maps-data-gis/) | overlays | No restrictions (Brock item metadata for NMC 3005; underlying 1826 map is public domain) | confirmed (2026-11-14) | Map scan: Library and Archives Canada; georeferencing: Brock University Map, Data & GIS Library |
| [Esri World Imagery (satellite / aerial basemap)](https://developers.arcgis.com/) | satellite | [Esri ArcGIS Location Platform terms (free tier; requires the user's own API key)](https://www.esri.com/en-us/legal/terms/full-master-agreement) | unconfirmed (2026-11-14) | Powered by Esri · Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community |
| [Goad's Insurance Plan of the City of Hamilton, January 1898 (McMaster University Library)](https://library.mcmaster.ca/maps/index-fire-insurance-plan-hamilton-1898) | overlays | Public domain ("Copyright, public domain" in McMaster's item records) | confirmed (2026-11-14) | Chas. E. Goad, Insurance Plan of the City of Hamilton (1898); facsimile courtesy of McMaster University Library; georeferenced for this app |
| [OpenFreeMap (online preview map before the offline download)](https://openfreemap.org) | basemap | [Free public instance, no key; map data ODbL (OpenStreetMap), OpenMapTiles schema CC-BY 4.0](https://github.com/hyperknot/openfreemap#attribution) | confirmed (2026-11-14) | OpenFreeMap © OpenMapTiles © OpenStreetMap contributors |
| [OpenStreetMap data](https://www.openstreetmap.org) | basemap, trails | [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright) | confirmed (2026-11-14) | © OpenStreetMap contributors |
| [Noto Sans glyphs and map sprites (basemaps-assets)](https://github.com/protomaps/basemaps-assets) | basemap | [Fonts SIL Open Font License 1.1; sprites derived from MIT-licensed tangrams/icons](https://github.com/protomaps/basemaps-assets#license) | confirmed (2026-11-14) | Noto Sans (SIL OFL 1.1); icons from tangrams/icons (MIT) |
| [Protomaps Basemap (tiles schema, daily OSM builds, map style)](https://github.com/protomaps/basemaps) | basemap | [Style code BSD-3-Clause; style design CC0; tiles are an ODbL Produced Work of OpenStreetMap](https://github.com/protomaps/basemaps/blob/main/LICENSE.md) | confirmed (2026-11-14) | Protomaps |
| [Terrain Tiles (elevation) on the Registry of Open Data on AWS](https://registry.opendata.aws/terrain-tiles/) | terrain | [Mixed open licences by source (Open Government Licence – Canada for Canadian data; public domain USGS data)](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) | confirmed (2026-11-14) | Elevation: Terrain Tiles (Tilezen); contains information licensed under the Open Government Licence – Canada; USGS 3DEP, GMTED2010 and SRTM data courtesy of the U.S. Geological Survey |
| [Historical Maps of Toronto tile services (Boulton 1858, Goad atlases, 1818, 1856, 1947)](https://www.arcgis.com/) | overlays | No reuse licence stated (maps are pre-1950 and out of copyright); viewed online only, never copied | unconfirmed (2026-11-14) | Scans: Toronto Public Library / City of Toronto Archives / Library and Archives Canada, via ArcGIS Online |
| [Ontario Historical County Maps Project (University of Toronto Map & Data Library)](https://mdl.library.utoronto.ca/collections/mdl-projects/ontario-county-map) | overlays | No reuse licence stated (underlying 1850s–1870s maps are public domain); viewed online only, never copied | unconfirmed (2026-11-14) | Historical county map georeferenced by the Ontario Historical County Maps Project, University of Toronto Map & Data Library |
| [Wikidata](https://www.wikidata.org) | places, settlements | [CC0 1.0 (structured data in the main namespace)](https://www.wikidata.org/wiki/Wikidata:Licensing) | confirmed (2026-11-14) | Wikidata (CC0) |
| [English Wikipedia](https://en.wikipedia.org) | places, settlements | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | confirmed (2026-11-14) | Text adapted from Wikipedia articles (CC BY-SA 4.0); each entry links its article revision |

## Notes per source

### Brock University Map, Data & GIS Library — Early Niagara georeferenced maps (`brock_early_niagara`)

- Provider: Brock University Map, Data & GIS Library (scans from Library and Archives Canada National Map Collection)
- Data: https://terra.library.brocku.ca/arcgis/rest/services/EarlyNiagara
- Licence check: **confirmed** — Item metadata read by the GitHub data build from the ImageServer's info/iteminfo (licenseInfo "No restrictions."; accessInformation "Map, Data & GIS Library, Brock University.")
- Check notes: Confirmed for NiagaraPeninsula1826NMC3005 only; each further Brock item is checked by the build log.
- Terms notes: The pipeline downloads each item's iteminfo (licenseInfo / accessInformation) and stores it next to the overlay; the build log prints it so the per-item licence can be confirmed.

### Esri World Imagery (satellite / aerial basemap) (`esri_world_imagery`)

- Provider: Esri, via ArcGIS Location Platform
- Data: https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer
- Licence check: **unconfirmed** — Search summaries of developers.arcgis.com pricing and Esri community answers; Esri pages blocked from build session
- Check notes: Confirm free tier needs no payment method before the user signs up.
- Terms notes: Streamed online only, never stored in a data pack. The API key is entered by the user on the phone and is never committed to the repository. Free tier reported as 2M basemap tiles/month (search summary).

### Goad's Insurance Plan of the City of Hamilton, January 1898 (McMaster University Library) (`mcmaster_goad_hamilton_1898`)

- Provider: McMaster University Library (facsimile of the British Library copy)
- Data: https://expo.mcmaster.ca/api/items?fulltext_search=Insurance%20plan%20of%20the%20city%20of%20Hamilton
- Licence check: **confirmed** — Rights field read from McMaster expo API item records by the GitHub research run
- Terms notes: McMaster's rights statement: "Copyright, public domain: McMaster University owns the rights to the archival copy of the digital image in TIFF format." The plan itself is public domain; we derive tiles from the image and credit McMaster.

### OpenFreeMap (online preview map before the offline download) (`openfreemap`)

- Provider: OpenFreeMap public instance
- Data: https://tiles.openfreemap.org/styles/dark
- Licence check: **confirmed** — Read README.md of github.com/hyperknot/openfreemap and openfreemap-styles
- Terms notes: Only used online until the offline basemap pack is downloaded. README: "no limits on the number of map views or requests ... no API keys"; attribution required (added automatically by MapLibre from the style).

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

### Terrain Tiles (elevation) on the Registry of Open Data on AWS (`terrain_tiles`)

- Provider: Tilezen / Mapzen terrain tiles, built from public elevation data; for Ontario mainly Natural Resources Canada's Canadian Digital Elevation Model, and USGS data across the border
- Data: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/
- Licence check: **confirmed** — The data build read tilezen/joerd docs/attribution.md: "Canada terrain data contains information licensed under the Open Government Licence – Canada", and USGS requests credit for 3DEP, SRTM and GMTED2010 ("… data courtesy of the U.S. Geological Survey"); the attribution text above carries both.

- Terms notes: Elevation tiles (Terrarium PNG encoding) are copied into an offline pack for the Toronto–Hamilton–Niagara area and shaded into hills on the phone. The joerd attribution document asks users to credit each underlying data provider; the data build downloads that document and prints the lines for Canada and the USA.

### Historical Maps of Toronto tile services (Boulton 1858, Goad atlases, 1818, 1856, 1947) (`toronto_historical_maps`)

- Provider: Published on ArcGIS Online; scans from Toronto Public Library, City of Toronto Archives and Library and Archives Canada
- Data: https://tiles.arcgis.com/tiles/jIL9msH9OI208GCb/arcgis/rest/services
- Licence check: **unconfirmed** — Service metadata (copyrightText) read by the GitHub discovery run; no licence field
- Terms notes: Each service's own copyright text is shown with the overlay. Streamed from the publisher's tile server when viewed; the pipeline never downloads or redistributes the tiles.

### Ontario Historical County Maps Project (University of Toronto Map & Data Library) (`uoft_county_maps`)

- Provider: University of Toronto Map & Data Library (scans of Tremaine and other 1850s–1870s county maps)
- Data: https://tiles.arcgis.com/tiles/9NvE8jKNWWlDGsUJ/arcgis/rest/services
- Licence check: **unconfirmed** — Service metadata read by the GitHub discovery run (licenseInfo empty); project pages blocked from build session
- Terms notes: The tiles are public ArcGIS Online services with no licence text. To respect that, the app streams them from U of T's server when viewed (like the project's own web viewer) and the pipeline never downloads or redistributes them.

### Wikidata (`wikidata`)

- Provider: Wikimedia Foundation and Wikidata contributors
- Licence check: **confirmed** — Wikidata:Licensing (via search summary; wikidata.org blocked from build session) — CC0 for main namespace is long-standing policy
- Terms notes: Used for published coordinates and dates of places. Attribution is not required but is given anyway.

### English Wikipedia (`wikipedia`)

- Provider: Wikipedia contributors / Wikimedia Foundation
- Licence check: **confirmed** — Reusing Wikipedia content guidance (via search summary; wikipedia.org blocked from build session)
- Terms notes: Place entries are short summaries written from the retrieved article text. Because they adapt CC BY-SA text, the entries themselves are CC BY-SA 4.0 and each one links the exact article revision it was written from.
