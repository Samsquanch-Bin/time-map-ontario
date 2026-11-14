"""Offline elevation pack for hill shading.

Copies the open Terrain Tiles from AWS for the focus area (Toronto, Hamilton,
Niagara) up to zoom 12 (about 28 m per pixel there), re-encodes them from
Terrarium to Mapbox terrain-RGB (the only encoding MapLibre React Native's
Android bridge decodes for a url source), writes an MBTiles file and converts
it to PMTiles. The phone shades the hills itself from these.
"""
from __future__ import annotations

import math
import sqlite3
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .config import BUILD_DIR, FOCUS_BBOX

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
ATTRIBUTION_DOC = "https://raw.githubusercontent.com/tilezen/joerd/master/docs/attribution.md"
TERRAIN_FILE = "terrain-focus.pmtiles"
MAX_ZOOM = 12
USER_AGENT = "TimeMapOntario-personal-map-build/0.2"


def tile_range(bbox: tuple[float, float, float, float], z: int) -> tuple[int, int, int, int]:
    """x0, y0, x1, y1 (inclusive, XYZ scheme) of the tiles covering bbox at zoom z."""
    w, s, e, n = bbox
    count = 2**z

    def xy(lon: float, lat: float) -> tuple[int, int]:
        x = int((lon + 180) / 360 * count)
        r = math.radians(lat)
        y = int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * count)
        return min(max(x, 0), count - 1), min(max(y, 0), count - 1)

    x0, y0 = xy(w, n)
    x1, y1 = xy(e, s)
    return x0, y0, x1, y1


def tiles_for(bbox: tuple[float, float, float, float], max_zoom: int) -> list[tuple[int, int, int]]:
    out = []
    for z in range(0, max_zoom + 1):
        x0, y0, x1, y1 = tile_range(bbox, z)
        out += [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    return out


def terrarium_to_terrain_rgb(png: bytes) -> bytes:
    """Re-encode one Terrarium PNG as Mapbox terrain-RGB (0.1 m steps), losslessly as PNG.

    Terrarium:   height = R * 256 + G + B / 256 - 32768
    terrain-RGB: height = -10000 + (R * 65536 + G * 256 + B) * 0.1
    """
    import io

    import numpy as np
    from PIL import Image

    rgb = np.asarray(Image.open(io.BytesIO(png)).convert("RGB"), dtype=np.float64)
    height = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
    code = np.clip(np.rint((height + 10000) * 10), 0, 256**3 - 1).astype(np.uint32)
    out = np.stack([(code >> 16) & 255, (code >> 8) & 255, code & 255], axis=-1).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(out, "RGB").save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def print_attribution_lines() -> None:
    """Print the joerd attribution lines for Canada and the USA into the build log."""
    import requests

    try:
        text = requests.get(ATTRIBUTION_DOC, timeout=60, headers={"User-Agent": USER_AGENT}).text
    except Exception as exc:  # noqa: BLE001 - informative only
        print(f"warning: could not read {ATTRIBUTION_DOC}: {exc}")
        return
    for line in text.splitlines():
        if any(k in line for k in ("Canada", "USGS", "U.S. Geological")):
            print(f"attribution doc: {line.strip()}")


def build_terrain(out_dir: Path = BUILD_DIR / "release", bbox=FOCUS_BBOX, max_zoom: int = MAX_ZOOM) -> Path:
    import requests

    print_attribution_lines()
    work = BUILD_DIR / "terrain"
    work.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    mbtiles = work / "terrain.mbtiles"
    mbtiles.unlink(missing_ok=True)
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    def fetch(t: tuple[int, int, int]) -> tuple[tuple[int, int, int], bytes | None]:
        z, x, y = t
        for attempt in range(4):
            try:
                r = session.get(TILE_URL.format(z=z, x=x, y=y), timeout=60)
                if r.status_code == 404:
                    return t, None
                r.raise_for_status()
                if not r.content.startswith(b"\x89PNG"):
                    raise ValueError("not a PNG")
                return t, terrarium_to_terrain_rgb(r.content)
            except Exception as exc:  # noqa: BLE001
                if attempt == 3:
                    raise RuntimeError(f"terrain tile {z}/{x}/{y}: {exc}") from exc
        return t, None

    tiles = tiles_for(bbox, max_zoom)
    print(f"terrain: {len(tiles)} tiles, zoom 0-{max_zoom}")
    db = sqlite3.connect(mbtiles)
    db.execute("CREATE TABLE metadata (name TEXT, value TEXT)")
    db.execute("CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)")
    w, s, e, n = bbox
    for k, v in {
        "name": "Terrain (Mapbox terrain-RGB encoding)",
        "format": "png",
        "type": "baselayer",
        "minzoom": "0",
        "maxzoom": str(max_zoom),
        "bounds": f"{w},{s},{e},{n}",
        "attribution": "Terrain Tiles (Tilezen); OGL-Canada; USGS",
    }.items():
        db.execute("INSERT INTO metadata VALUES (?, ?)", (k, v))
    stored = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        for (z, x, y), data in pool.map(fetch, tiles):
            if data is None:
                continue
            db.execute("INSERT INTO tiles VALUES (?, ?, ?, ?)", (z, x, (2**z - 1) - y, data))  # MBTiles rows are TMS
            stored += 1
    db.commit()
    db.close()
    if stored < len(tiles) * 0.9:
        raise RuntimeError(f"terrain: only {stored} of {len(tiles)} tiles downloaded")
    out = out_dir / TERRAIN_FILE
    out.unlink(missing_ok=True)
    subprocess.run(["pmtiles", "convert", str(mbtiles), str(out)], check=True)
    print(f"terrain: {stored} tiles -> {out} ({out.stat().st_size / 1e6:.0f} MB)")
    return out
