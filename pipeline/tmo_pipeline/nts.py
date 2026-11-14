"""National Topographic System (NTS) sheet extents.

Old federal topographic maps are named by NTS sheet (e.g. 030M05C). The printed
map sits inside a "neat line" whose corners are exactly the sheet's latitude and
longitude limits, so a scanned sheet can be trimmed to its map area (dropping the
legend margins that would otherwise cover the neighbouring sheet) from its name
alone. Covers the southern series (below 68°N), which includes all of Ontario's
settled south.

  series ``NNN``   4° lat × 8° lon  (units digit -> latitude band, rest -> longitude band)
  letter ``A–P``   1° × 2°, 4 × 4, numbered in a snake from the south-east corner
  number ``1–16``  15' × 30', 4 × 4, same snake
  letter ``a–h``   7.5' × 7.5', 2 rows × 4 (1:25,000 sheets), same snake
"""
from __future__ import annotations

import re

_SHEET = re.compile(r"^(\d{3})([A-P])(\d{2})?([A-H])?$", re.I)


def _snake(index: int, cols: int) -> tuple[int, int]:
    """(row from south, column from west) of the index-th cell (0-based) in a
    snake numbering that starts at the south-east corner and runs west."""
    row, k = divmod(index, cols)
    col = cols - 1 - k if row % 2 == 0 else k
    return row, col


def sheet_bounds(sheet: str) -> tuple[float, float, float, float]:
    """(west, south, east, north) in degrees for an NTS sheet such as 030M,
    030M05 or 030M05C."""
    m = _SHEET.match(sheet.strip())
    if not m:
        raise ValueError(f"not an NTS sheet: {sheet!r}")
    series, block, number, sub = m.group(1), m.group(2).upper(), m.group(3), m.group(4)
    tens, units = int(series[:-1]), int(series[-1])
    south = 40.0 + 4 * units
    east = -(48.0 + 8 * tens)
    west = east - 8.0
    # 1° × 2° block
    r, c = _snake(ord(block) - ord("A"), 4)
    south, west = south + r * 1.0, west + c * 2.0
    lat_h, lon_w = 1.0, 2.0
    if number:
        n = int(number)
        if not 1 <= n <= 16:
            raise ValueError(f"bad map number in {sheet!r}")
        r, c = _snake(n - 1, 4)
        lat_h, lon_w = 0.25, 0.5
        south, west = south + r * lat_h, west + c * lon_w
        if sub:
            r, c = _snake(ord(sub.upper()) - ord("A"), 4)
            lat_h, lon_w = 0.125, 0.125
            south, west = south + r * lat_h, west + c * lon_w
    return (round(west, 6), round(south, 6), round(west + lon_w, 6), round(south + lat_h, 6))


def sheets_polygon(sheets: list[str]) -> dict:
    """GeoJSON MultiPolygon (WGS84) of one or more sheets: the neat-line area of a
    combined printing such as 030M05G,B,H."""
    polys = []
    for s in sheets:
        w, so, e, n = sheet_bounds(s)
        polys.append([[[w, so], [e, so], [e, n], [w, n], [w, so]]])
    return {"type": "MultiPolygon", "coordinates": polys}
