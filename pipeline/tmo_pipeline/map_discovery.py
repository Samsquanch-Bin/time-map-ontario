"""List georeferenced historical maps published on ArcGIS servers.

Runs in GitHub Actions (``python -m tmo_pipeline maps-discover``). For every
ImageServer / MapServer under the configured roots it records the extent (as
WGS84 bounds), the native pixel size, and the item licence text, then writes
``data/research/map-services.json`` so overlays can be picked from facts rather
than guesses.
"""
from __future__ import annotations

import datetime as dt
import json
import math
from pathlib import Path
from typing import Any

from .research import RESEARCH_DIR, USER_AGENT

ROOTS = [
    "https://terra.library.brocku.ca/arcgis/rest/services",
]


def mercator_to_lonlat(x: float, y: float) -> tuple[float, float]:
    lon = x / 6378137.0 * 180 / math.pi
    lat = (2 * math.atan(math.exp(y / 6378137.0)) - math.pi / 2) * 180 / math.pi
    return lon, lat


def service_urls(directory: dict[str, Any], base: str) -> tuple[list[str], list[str]]:
    """(folder URLs, service URLs) listed in an ArcGIS services directory JSON."""
    root = base.split("/rest/services")[0] + "/rest/services"
    folders = [f"{root}/{f}" for f in directory.get("folders", [])]
    services = [f"{root}/{s['name']}/{s['type']}" for s in directory.get("services", []) if s.get("type") in ("ImageServer", "MapServer")]
    return folders, services


def _get(s, url: str) -> dict[str, Any]:
    for attempt in range(3):
        try:
            r = s.get(url, params={"f": "json"}, timeout=60)
            r.raise_for_status()
            return r.json()
        except Exception as exc:  # noqa: BLE001
            last = exc
    print(f"failed {url}: {last}")
    return {}


def _wgs84_bounds(s, info: dict[str, Any], url: str) -> list[float] | None:
    ext = info.get("extent") or info.get("fullExtent")
    if not ext:
        return None
    sr = ext.get("spatialReference", {})
    wkid = sr.get("latestWkid") or sr.get("wkid")
    if wkid == 4326:
        return [ext["xmin"], ext["ymin"], ext["xmax"], ext["ymax"]]
    if wkid in (3857, 102100):
        w, s_ = mercator_to_lonlat(ext["xmin"], ext["ymin"])
        e, n = mercator_to_lonlat(ext["xmax"], ext["ymax"])
        return [w, s_, e, n]
    # ask the server's geometry service-free route: project via the service itself isn't
    # standard, so use the public ArcGIS project op on the same server if present
    root = url.split("/rest/services")[0]
    try:
        r = s.get(
            f"{root}/rest/services/Utilities/Geometry/GeometryServer/project",
            params={
                "inSR": wkid,
                "outSR": 4326,
                "geometries": json.dumps({"geometryType": "esriGeometryPoint", "geometries": [{"x": ext["xmin"], "y": ext["ymin"]}, {"x": ext["xmax"], "y": ext["ymax"]}]}),
                "f": "json",
            },
            timeout=60,
        ).json()
        (a, b) = r["geometries"]
        return [a["x"], a["y"], b["x"], b["y"]]
    except Exception:  # noqa: BLE001
        return None


def discover(roots: list[str] = ROOTS, out: Path = RESEARCH_DIR / "map-services.json") -> list[dict[str, Any]]:
    import requests

    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    todo = list(roots)
    seen: set[str] = set()
    results = []
    while todo:
        url = todo.pop(0)
        if url in seen:
            continue
        seen.add(url)
        d = _get(s, url)
        folders, services = service_urls(d, url)
        todo.extend(folders)
        for svc in services:
            info = _get(s, svc)
            if not info:
                continue
            item = _get(s, f"{svc}/info/iteminfo")
            results.append(
                {
                    "url": svc,
                    "name": info.get("name") or info.get("mapName") or svc.rsplit("/", 2)[-2],
                    "description": (info.get("description") or info.get("serviceDescription") or "")[:500],
                    "bounds_wgs84": _wgs84_bounds(s, info, svc),
                    "pixel_size": [info.get("pixelSizeX"), info.get("pixelSizeY")],
                    "band_count": info.get("bandCount"),
                    "item_title": item.get("title", ""),
                    "item_snippet": item.get("snippet", ""),
                    "item_tags": item.get("tags", []),
                    "licence": item.get("licenseInfo", ""),
                    "access": item.get("accessInformation", ""),
                }
            )
            print(f"{svc}: {results[-1]['item_title'] or results[-1]['name']}")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"retrieved": dt.date.today().isoformat(), "roots": roots, "services": results}, indent=1, ensure_ascii=False))
    print(f"{len(results)} services")
    return results
