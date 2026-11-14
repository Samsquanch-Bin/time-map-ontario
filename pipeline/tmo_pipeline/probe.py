"""Look inside image files before writing an overlay for them (runs in GitHub Actions).

Reads ``data/research/probe.yaml``::

    files:
      - url: https://.../photo.zip      # a raster, or a zip holding one
        crops: [[-79.68, 43.45, 600]]   # optional [lon, lat, half-width in metres]

For each file it records the archive listing and, for every raster GDAL can open,
size, bands, CRS, georeferenced extent (WGS84) and nodata, plus a small preview
JPEG and optional full-resolution crops. Output goes to ``data/research/probe/``.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

import yaml

from .research import RESEARCH_DIR, USER_AGENT, slugify

RASTER_EXT = (".tif", ".tiff", ".jpg", ".jpeg", ".png", ".jp2", ".sid", ".ecw", ".img")


def _gdalinfo(path: Path) -> dict:
    r = subprocess.run(["gdalinfo", "-json", str(path)], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else {"error": r.stderr[-500:]}


def _summary(info: dict) -> dict:
    if "error" in info:
        return info
    bands = info.get("bands", [])
    return {
        "size": info.get("size"),
        "bands": [{"type": b.get("type"), "colour": b.get("colorInterpretation"), "nodata": b.get("noDataValue")} for b in bands],
        "crs": ((info.get("coordinateSystem") or {}).get("wkt") or "")[:120],
        "geotransform": info.get("geoTransform"),
        "wgs84_extent": info.get("wgs84Extent"),
        "metadata": {k: v for k, v in (info.get("metadata") or {}).get("", {}).items()},
    }


def run(config: Path = RESEARCH_DIR / "probe.yaml", out_dir: Path = RESEARCH_DIR / "probe") -> None:
    import requests

    cfg = yaml.safe_load(config.read_text()) or {}
    out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for entry in cfg.get("files", []):
        url = entry["url"]
        name = slugify(url.split("://", 1)[-1].rsplit("/", 1)[-1])[:60]
        rec: dict = {"url": url}
        results.append(rec)
        tmp = Path(tempfile.mkdtemp())
        try:
            dl = tmp / url.rsplit("/", 1)[-1]
            with requests.get(url, stream=True, timeout=600, headers={"User-Agent": USER_AGENT}) as r:
                rec["status"] = r.status_code
                r.raise_for_status()
                with dl.open("wb") as fh:
                    shutil.copyfileobj(r.raw, fh, 1 << 20)
            rec["bytes"] = dl.stat().st_size
            files = [dl]
            if zipfile.is_zipfile(dl):
                with zipfile.ZipFile(dl) as z:
                    rec["zip"] = [{"name": i.filename, "bytes": i.file_size} for i in z.infolist()]
                    z.extractall(tmp / "x")
                files = sorted(p for p in (tmp / "x").rglob("*") if p.is_file())
            rec["rasters"] = []
            for f in files:
                if f.suffix.lower() not in RASTER_EXT:
                    continue
                info = _gdalinfo(f)
                s = _summary(info) | {"file": f.name}
                rec["rasters"].append(s)
                if "error" in info:
                    continue
                prev = out_dir / f"{name}-{slugify(f.stem)[:40]}-preview.jpg"
                subprocess.run(["gdal_translate", "-q", "-of", "JPEG", "-outsize", "1024", "0", "-b", "1", str(f), str(prev)], check=False)
                for i, (lon, lat, half) in enumerate(entry.get("crops") or []):
                    crop = out_dir / f"{name}-{slugify(f.stem)[:40]}-crop{i}.jpg"
                    subprocess.run(["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857", "-te_srs", "EPSG:4326",
                                    "-te", str(lon - half / 80000), str(lat - half / 111000), str(lon + half / 80000), str(lat + half / 111000),
                                    "-ts", "800", "0", "-of", "GTiff", str(f), str(tmp / "c.tif")], check=False)
                    subprocess.run(["gdal_translate", "-q", "-of", "JPEG", "-b", "1", str(tmp / "c.tif"), str(crop)], check=False)
        except Exception as exc:  # noqa: BLE001
            rec["error"] = str(exc)[:300]
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print(json.dumps(rec)[:600], flush=True)
    (out_dir / "summary.json").write_text(json.dumps(results, indent=1))
