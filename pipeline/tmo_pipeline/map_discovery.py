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
import re
from pathlib import Path
from typing import Any

from .research import RESEARCH_DIR, USER_AGENT

# Server roots that allow folder listing (Brock's top level returns 403, so list folders).
ROOTS = [
    "https://terra.library.brocku.ca/arcgis/rest/services/EarlyNiagara",
    "https://terra.library.brocku.ca/arcgis/rest/services/NiagaraTopos",
    "https://terra.library.brocku.ca/arcgis/rest/services/AirPhotos",
    "https://tiles.arcgis.com/tiles/jIL9msH9OI208GCb/arcgis/rest/services",
    "https://tiles.arcgis.com/tiles/wjcPoefzjpzCgffS/arcgis/rest/services",
    "https://ww2.yorkmaps.ca/arcgis/rest/services/CacheMaps",
    "https://tiles.arcgis.com/tiles/9NvE8jKNWWlDGsUJ/arcgis/rest/services",  # U of T Ontario Historical County Maps
]
# ArcGIS Online public search: finds georeferenced map layers others have published.
AGOL_SEARCH = "https://www.arcgis.com/sharing/rest/search"
AGOL_QUERIES = [
    "Hamilton 1859", "Hamilton historical map", "Hamilton fire insurance plan", "Wentworth County 1859",
    "Wentworth County 1875 atlas", "Surtees Wentworth", "Barton Township historical", "Ancaster historical map",
    "Dundas Ontario historical map", "Halton County 1858 Tremaine", "Peel County 1859 Tremaine",
    "Ontario Historical County Maps", "Tremaine map", "Toronto Goad", "Hamilton Goad",
    "Burlington historical map", "Burlington 1954", "Oakville historical map", "Oakville 1877",
    "Mississauga historical map", "Port Credit historical", "Streetsville historical", "Etobicoke historical map",
    "Halton atlas 1877", "Peel atlas 1877", "air photos 1954 Ontario", "Mississauga 1954",
]
LAYER_TYPES = ("Map Service", "Image Service", "Tile Layer", "WMS", "WMTS")


def mercator_to_lonlat(x: float, y: float) -> tuple[float, float]:
    lon = x / 6378137.0 * 180 / math.pi
    lat = (2 * math.atan(math.exp(y / 6378137.0)) - math.pi / 2) * 180 / math.pi
    return lon, lat


def service_urls(directory: dict[str, Any], base: str) -> tuple[list[str], list[str]]:
    """(folder URLs, service URLs) listed in an ArcGIS services directory JSON."""
    if not isinstance(directory, dict):
        return [], []
    root = base.split("/rest/services")[0] + "/rest/services"
    folders = [f"{root}/{f}" for f in directory.get("folders") or [] if isinstance(f, str)]
    services = []
    for svc in directory.get("services") or []:
        if not isinstance(svc, dict) or svc.get("type") not in ("ImageServer", "MapServer"):
            continue
        services.append(svc.get("url") or f"{root}/{svc['name']}/{svc['type']}")
    return folders, services


def _get(s, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    last: Exception | None = None
    for attempt in range(3):
        try:
            r = s.get(url, params={"f": "json", **(params or {})}, timeout=60)
            r.raise_for_status()
            data = r.json()
            return data if isinstance(data, dict) else {"_list": data}
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
                    **tile_summary(info),
                    "item_title": item.get("title", ""),
                    "item_snippet": item.get("snippet", ""),
                    "item_tags": item.get("tags", []),
                    "licence": item.get("licenseInfo", ""),
                    "access": item.get("accessInformation", ""),
                }
            )
            print(f"{svc}: {results[-1]['item_title'] or results[-1]['name']}")
    warpers = discover_mapwarper(s)
    online = search_arcgis_online(s)
    for it in online:
        if it.get("url") and it["url"] not in {r["url"] for r in results} and ("MapServer" in it["url"] or "ImageServer" in it["url"]):
            info = _get(s, it["url"])
            it["pixel_size"] = [info.get("pixelSizeX"), info.get("pixelSizeY")]
            it["bounds_wgs84_service"] = _wgs84_bounds(s, info, it["url"]) if info else None
            it["tiled"] = bool(info.get("tileInfo"))
            it["export_tiles_allowed"] = info.get("exportTilesAllowed")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"retrieved": dt.date.today().isoformat(), "roots": roots, "services": results, "arcgis_online": online, "mapwarper": warpers}, indent=1, ensure_ascii=False))
    print(f"{len(results)} services")
    return results


def search_arcgis_online(s, queries: list[str] = AGOL_QUERIES) -> list[dict[str, Any]]:
    """Public ArcGIS Online items (layers and web maps) matching the queries."""
    found: dict[str, dict[str, Any]] = {}
    for q in queries:
        d = _get(s, AGOL_SEARCH, {"q": q, "num": 50})
        for it in d.get("results", []):
            if it["id"] in found or it.get("access") != "public":
                continue
            if it.get("type") not in LAYER_TYPES + ("Web Map", "Web Mapping Application"):
                continue
            ext = it.get("extent") or []
            bounds = [ext[0][0], ext[0][1], ext[1][0], ext[1][1]] if len(ext) == 2 else None
            found[it["id"]] = {
                "id": it["id"],
                "title": it.get("title", ""),
                "type": it.get("type"),
                "owner": it.get("owner"),
                "url": it.get("url") or "",
                "bounds_wgs84": bounds,
                "snippet": (it.get("snippet") or "")[:300],
                "licence": re.sub("<[^>]+>", " ", it.get("licenseInfo") or "")[:400].strip(),
                "access_information": (it.get("accessInformation") or "")[:200],
                "query": q,
            }
        print(f"AGOL '{q}': {len(d.get('results', []))} results")
    # web maps: list their operational layer URLs
    for it in list(found.values()):
        if it["type"] == "Web Map":
            data = _get(s, f"https://www.arcgis.com/sharing/rest/content/items/{it['id']}/data")
            it["layers"] = [{"title": l.get("title"), "url": l.get("url")} for l in data.get("operationalLayers", []) if l.get("url")][:40]
    return sorted(found.values(), key=lambda x: x["title"])


def tile_summary(info: dict[str, Any]) -> dict[str, Any]:
    """Zoom range and tiling scheme of a cached (tiled) map service."""
    ti = info.get("tileInfo")
    if not ti:
        return {"tiled": False}
    lods = [l["level"] for l in ti.get("lods", [])]
    sr = ti.get("spatialReference", {})
    return {
        "tiled": True,
        "tile_wkid": sr.get("latestWkid") or sr.get("wkid"),
        "tile_size": ti.get("rows"),
        "min_lod": info.get("minLOD", min(lods) if lods else None),
        "max_lod": info.get("maxLOD", max(lods) if lods else None),
        "copyright": (info.get("copyrightText") or "")[:300],
    }


MAPWARPERS = ["https://mapexplorer.mcmaster.ca"]


def discover_mapwarper(s, hosts: list[str] = MAPWARPERS) -> list[dict[str, Any]]:
    """Layers and maps on MapWarper sites (tile URL: /layers/tile/{id}/{z}/{x}/{y}.png)."""
    out = []
    for host in hosts:
        for kind in ("layers", "maps"):
            for path in (f"/api/v1/{kind}?per_page=100", f"/{kind}.json?per_page=100"):
                try:
                    r = s.get(host + path, timeout=60)
                    data = r.json()
                except Exception as exc:  # noqa: BLE001
                    print(f"mapwarper {host}{path}: {exc}")
                    continue
                items = data.get("data", data.get("items", data)) if isinstance(data, dict) else data
                if isinstance(items, list) and items:
                    for it in items:
                        attrs = it.get("attributes", it) if isinstance(it, dict) else {}
                        out.append({"host": host, "kind": kind, "id": it.get("id") if isinstance(it, dict) else None,
                                    "title": attrs.get("title") or attrs.get("name"), "bbox": attrs.get("bbox"),
                                    "status": attrs.get("status"), "year": attrs.get("depicts_year") or attrs.get("year"),
                                    "raw_keys": sorted(attrs.keys())[:30]})
                    print(f"mapwarper {host}{path}: {len(items)} {kind}")
                    break
    return out
