# Control points: Goad's 1898 fire insurance plan of Hamilton

One JSON per sheet: `crop` (the part of the sheet used, in original-image pixels) and
`gcps` = `[pixel x, pixel y, lon, lat, modern intersection]`.

- **Pixel positions:** read from McMaster University Library's facsimile images.
- **Coordinates:** street-centre intersections from OpenStreetMap (© OpenStreetMap contributors, ODbL).
- **Fitting:** each sheet is fitted with an affine transform. `pipeline/tmo_pipeline/georef.py` reports per-point residuals in metres.

**Not used:**
- Sheets 60 and 65: too few streets survive with the same name.
- Sheets 34 and 38: the waterfront has been realigned, so their fits aren't trustworthy.
