"""Historical map overlay definitions and processing.

Each overlay is described by ``pipeline/overlays/<id>.yaml``. Processing turns a
georeferenced source image into a raster PMTiles archive plus a metadata JSON
(bounds, zoom range, footprint polygon, licence text found at the source).

Processing shells out to GDAL command-line tools and the ``pmtiles`` CLI; those
are installed in the GitHub Actions data workflow. Pure planning logic lives in
small functions so it can be unit-tested without GDAL.
"""
from __future__ import annotations

import json
import math
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .config import BUILD_DIR, CACHE_DIR, OVERLAYS_DIR

WEB_MERCATOR_WORLD_M = 2 * math.pi * 6378137.0


class OverlayError(ValueError):
    pass


@dataclass(frozen=True)
class OverlayDef:
    id: str
    title: str
    year: int
    source: str
    fetch: dict[str, Any]
    accuracy_note: str
    description: str = ""
    year_end: int | None = None
    minzoom: int = 8
    maxzoom: int | None = None  # None = derived from source resolution
    sample: bool = False

    @property
    def era(self) -> tuple[int, int]:
        return (self.year, self.year_end or self.year)


REQUIRED = ("id", "title", "year", "source", "fetch", "accuracy_note")


def parse_overlay(data: dict[str, Any], origin: str = "<overlay>") -> OverlayDef:
    missing = [k for k in REQUIRED if data.get(k) in (None, "")]
    if missing:
        raise OverlayError(f"{origin}: missing {', '.join(missing)}")
    year = int(data["year"])
    if not 1400 <= year <= 2100:
        raise OverlayError(f"{origin}: implausible year {year}")
    year_end = data.get("year_end")
    if year_end is not None and int(year_end) < year:
        raise OverlayError(f"{origin}: year_end before year")
    fetch = data["fetch"]
    if fetch.get("method") not in ("arcgis_imageserver", "geotiff_url"):
        raise OverlayError(f"{origin}: unknown fetch.method {fetch.get('method')!r}")
    if not fetch.get("url"):
        raise OverlayError(f"{origin}: fetch.url required")
    return OverlayDef(
        id=str(data["id"]),
        title=str(data["title"]),
        year=year,
        year_end=int(year_end) if year_end is not None else None,
        source=str(data["source"]),
        fetch=dict(fetch),
        accuracy_note=str(data["accuracy_note"]).strip(),
        description=str(data.get("description", "")).strip(),
        minzoom=int(data.get("minzoom", 8)),
        maxzoom=int(data["maxzoom"]) if data.get("maxzoom") is not None else None,
        sample=bool(data.get("sample", False)),
    )


def load_overlays(directory: Path = OVERLAYS_DIR) -> dict[str, OverlayDef]:
    out: dict[str, OverlayDef] = {}
    for path in sorted(directory.glob("*.yaml")):
        with path.open(encoding="utf-8") as fh:
            ov = parse_overlay(yaml.safe_load(fh), origin=path.name)
        if ov.id != path.stem:
            raise OverlayError(f"{path.name}: id '{ov.id}' must match file name")
        out[ov.id] = ov
    return out


# ---------------------------------------------------------------- planning helpers


def plan_export_windows(
    extent: tuple[float, float, float, float],
    pixel_size: tuple[float, float],
    max_size: tuple[int, int],
) -> list[dict[str, Any]]:
    """Split an ImageServer extent into exportImage requests at native resolution.

    ``extent`` is (xmin, ymin, xmax, ymax) in the service's spatial reference,
    ``pixel_size`` is (x, y) in the same units, ``max_size`` is the service's
    (maxImageWidth, maxImageHeight). Returns windows ordered row by row from the
    top-left, each with ``bbox`` and ``size`` (width, height) in pixels.
    """
    xmin, ymin, xmax, ymax = extent
    px, py = pixel_size
    if px <= 0 or py <= 0:
        raise OverlayError("pixel size must be positive")
    if xmax <= xmin or ymax <= ymin:
        raise OverlayError("empty extent")
    total_w = math.ceil((xmax - xmin) / px)
    total_h = math.ceil((ymax - ymin) / py)
    max_w, max_h = max_size
    windows = []
    for row, y0 in enumerate(range(0, total_h, max_h)):
        h = min(max_h, total_h - y0)
        for col, x0 in enumerate(range(0, total_w, max_w)):
            w = min(max_w, total_w - x0)
            bxmin = xmin + x0 * px
            bymax = ymax - y0 * py
            windows.append(
                {
                    "row": row,
                    "col": col,
                    "size": (w, h),
                    "bbox": (bxmin, bymax - h * py, bxmin + w * px, bymax),
                }
            )
    return windows


def zoom_for_resolution(metres_per_pixel: float, latitude: float, tile_size: int = 256) -> int:
    """Smallest web-mercator zoom whose ground resolution is at least as fine as
    the source (so we don't throw detail away), capped at 19."""
    if metres_per_pixel <= 0:
        raise OverlayError("resolution must be positive")
    ground = WEB_MERCATOR_WORLD_M * math.cos(math.radians(latitude)) / tile_size
    z = math.ceil(math.log2(ground / metres_per_pixel))
    return max(0, min(19, z))


# ---------------------------------------------------------------- processing (GDAL)


def _run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def _require_tools(*names: str) -> None:
    missing = [n for n in names if shutil.which(n) is None]
    if missing:
        raise OverlayError(f"missing tools on PATH: {', '.join(missing)} (run inside the data workflow)")


def fetch_arcgis_imageserver(ov: OverlayDef, workdir: Path) -> tuple[Path, dict[str, Any]]:
    """Download an ArcGIS ImageServer at native resolution as a georeferenced VRT."""
    import requests  # local import keeps unit tests light

    url = ov.fetch["url"].rstrip("/")
    info = requests.get(url, params={"f": "json"}, timeout=60).json()
    if "error" in info:
        raise OverlayError(f"{ov.id}: ImageServer error {info['error']}")
    item = {}
    try:
        item = requests.get(f"{url}/info/iteminfo", params={"f": "json"}, timeout=60).json()
    except Exception as exc:  # noqa: BLE001 - metadata is informative only
        print(f"warning: could not read iteminfo: {exc}")
    ext = info["extent"]
    sr = ext["spatialReference"]
    wkid = sr.get("latestWkid") or sr.get("wkid")
    windows = plan_export_windows(
        (ext["xmin"], ext["ymin"], ext["xmax"], ext["ymax"]),
        (info["pixelSizeX"], info["pixelSizeY"]),
        (int(info.get("maxImageWidth", 4000)), int(info.get("maxImageHeight", 4000))),
    )
    print(f"{ov.id}: {len(windows)} export window(s), EPSG:{wkid}")
    tiles = []
    for win in windows:
        raw = workdir / f"win_{win['row']}_{win['col']}.raw"
        geo = workdir / f"win_{win['row']}_{win['col']}.tif"
        params = {
            "bbox": ",".join(f"{v:.6f}" for v in win["bbox"]),
            "bboxSR": wkid,
            "imageSR": wkid,
            "size": f"{win['size'][0]},{win['size'][1]}",
            "format": "tiff",
            "pixelType": "U8",
            "interpolation": "RSP_BilinearInterpolation",
            "f": "image",
        }
        resp = requests.get(f"{url}/exportImage", params=params, timeout=600)
        resp.raise_for_status()
        if "image" not in resp.headers.get("content-type", "") and not resp.content[:4] in (b"II*\x00", b"MM\x00*"):
            raise OverlayError(f"{ov.id}: exportImage did not return an image: {resp.text[:300]}")
        raw.write_bytes(resp.content)
        xmin, ymin, xmax, ymax = win["bbox"]
        _run(["gdal_translate", "-q", "-a_srs", f"EPSG:{wkid}", "-a_ullr", str(xmin), str(ymax), str(xmax), str(ymin), str(raw), str(geo)])
        tiles.append(str(geo))
    vrt = workdir / "mosaic.vrt"
    _run(["gdalbuildvrt", "-q", str(vrt), *tiles])
    meta = {
        "source_epsg": wkid,
        "source_pixel_size": [info["pixelSizeX"], info["pixelSizeY"]],
        "source_url": url,
        "source_item_licence": item.get("licenseInfo", ""),
        "source_item_access": item.get("accessInformation", ""),
        "source_item_title": item.get("title", ""),
    }
    print(f"{ov.id}: item licence text: {meta['source_item_licence']!r}; access: {meta['source_item_access']!r}")
    return vrt, meta


def build_overlay(ov: OverlayDef, out_dir: Path = BUILD_DIR / "release") -> dict[str, Any]:
    _require_tools("gdal_translate", "gdalbuildvrt", "gdalwarp", "gdaladdo", "gdal_polygonize.py", "ogr2ogr", "pmtiles")
    work = CACHE_DIR / "overlays" / ov.id
    work.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    if ov.fetch["method"] == "arcgis_imageserver":
        src, meta = fetch_arcgis_imageserver(ov, work)
    else:
        import requests

        src = work / "source.tif"
        with requests.get(ov.fetch["url"], stream=True, timeout=600) as r:
            r.raise_for_status()
            with src.open("wb") as fh:
                shutil.copyfileobj(r.raw, fh)
        meta = {"source_url": ov.fetch["url"]}

    src = to_rgb(src, work)
    nodata = ov.fetch.get("nodata")
    warped = work / "warped_3857.tif"
    cmd = ["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857", "-r", "bilinear", "-dstalpha", "-co", "COMPRESS=DEFLATE", "-co", "TILED=YES", "-co", "BIGTIFF=IF_SAFER"]
    if nodata is not None:
        cmd += ["-srcnodata", str(nodata)]
    _run(cmd + [str(src), str(warped)])

    mbtiles = work / f"{ov.id}.mbtiles"
    mbtiles.unlink(missing_ok=True)
    _run(["gdal_translate", "-q", "-of", "MBTILES", "-co", "TILE_FORMAT=WEBP", "-co", "QUALITY=85", "-co", "ZOOM_LEVEL_STRATEGY=UPPER", "-co", f"NAME={ov.title}", str(warped), str(mbtiles)])
    # Overviews down to minzoom: each factor of 2 is one zoom level.
    _, maxzoom = mbtiles_zoom_range(mbtiles)
    levels = [str(2**i) for i in range(1, max(1, maxzoom - ov.minzoom) + 1)]
    _run(["gdaladdo", "-q", "-r", "average", str(mbtiles), *levels])
    minzoom, maxzoom = mbtiles_zoom_range(mbtiles)
    pmtiles_path = out_dir / f"overlay-{ov.id}.pmtiles"
    pmtiles_path.unlink(missing_ok=True)
    _run(["pmtiles", "convert", str(mbtiles), str(pmtiles_path)])

    footprint = compute_footprint(warped, work)
    bounds = geojson_bounds(footprint)
    meta.update(
        {
            "id": ov.id,
            "file": pmtiles_path.name,
            "minzoom": minzoom,
            "maxzoom": maxzoom,
            "bounds": bounds,
            "footprint": footprint,
        }
    )
    (out_dir.parent / "overlay-meta").mkdir(parents=True, exist_ok=True)
    (out_dir.parent / "overlay-meta" / f"{ov.id}.json").write_text(json.dumps(meta, indent=2))
    return meta


def rgb_band_args(bands: list[dict[str, Any]]) -> list[str] | None:
    """gdal_translate arguments that turn a source into 3-band RGB, or None if it
    already is RGB(A). Scans are often single-band greyscale or paletted, which
    WebP tiles can't store directly."""
    n = len(bands)
    if n == 1:
        if bands[0].get("colorInterpretation") == "Palette" or "colorTable" in bands[0]:
            return ["-expand", "rgb"]
        return ["-b", "1", "-b", "1", "-b", "1"]
    if n == 2:  # grey + alpha
        return ["-b", "1", "-b", "1", "-b", "1", "-b", "2"]
    if n in (3, 4):
        return None
    raise OverlayError(f"unexpected band count {n}")


def to_rgb(src: Path, work: Path) -> Path:
    info = json.loads(subprocess.run(["gdalinfo", "-json", str(src)], check=True, capture_output=True, text=True).stdout)
    args = rgb_band_args(info.get("bands", []))
    if args is None:
        return src
    out = work / "rgb.vrt"
    _run(["gdal_translate", "-q", "-of", "VRT", *args, str(src), str(out)])
    return out


def mbtiles_zoom_range(path: Path) -> tuple[int, int]:
    """(minzoom, maxzoom) actually present in an MBTiles file."""
    import sqlite3

    con = sqlite3.connect(str(path))
    try:
        lo, hi = con.execute("SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles").fetchone()
    finally:
        con.close()
    if lo is None:
        raise OverlayError(f"{path.name} contains no tiles")
    return int(lo), int(hi)


def compute_footprint(warped: Path, work: Path) -> dict[str, Any]:
    """Polygon (WGS84) of where the overlay has data, from its alpha band."""
    small = work / "alpha_small.tif"
    poly = work / "footprint_3857.geojson"
    out = work / "footprint_4326.geojson"
    for p in (poly, out):
        p.unlink(missing_ok=True)
    info = json.loads(subprocess.run(["gdalinfo", "-json", str(warped)], check=True, capture_output=True, text=True).stdout)
    alpha_band = str(len(info["bands"]))  # gdalwarp -dstalpha puts alpha last
    _run(["gdal_translate", "-q", "-b", alpha_band, "-outsize", "5%", "5%", "-r", "nearest", str(warped), str(small)])
    _run(["gdal_polygonize.py", "-q", str(small), "-f", "GeoJSON", str(poly), "footprint", "DN"])
    _run(["ogr2ogr", "-t_srs", "EPSG:4326", "-where", "DN > 0", "-simplify", "0.0005", "-f", "GeoJSON", str(out), str(poly)])
    fc = json.loads(out.read_text())
    return merge_polygons(fc)


def merge_polygons(fc: dict[str, Any]) -> dict[str, Any]:
    """Combine a FeatureCollection's polygons into one MultiPolygon geometry,
    dropping slivers smaller than 1% of the largest part."""
    parts: list[list] = []
    for feat in fc.get("features", []):
        g = feat.get("geometry") or {}
        if g.get("type") == "Polygon":
            parts.append(g["coordinates"])
        elif g.get("type") == "MultiPolygon":
            parts.extend(g["coordinates"])
    if not parts:
        raise OverlayError("footprint is empty — overlay has no visible pixels")
    areas = [abs(_ring_area(p[0])) for p in parts]
    biggest = max(areas)
    kept = [p for p, a in zip(parts, areas) if a >= biggest * 0.01]
    return {"type": "MultiPolygon", "coordinates": kept}


def _ring_area(ring: list) -> float:
    return 0.5 * sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))


def geojson_bounds(geom: dict[str, Any]) -> list[float]:
    xs: list[float] = []
    ys: list[float] = []

    def walk(c: Any) -> None:
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for cc in c:
                walk(cc)

    walk(geom["coordinates"])
    return [round(min(xs), 6), round(min(ys), 6), round(max(xs), 6), round(max(ys), 6)]
