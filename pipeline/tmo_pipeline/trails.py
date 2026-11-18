"""Trails pack: hiking trails and footpaths from OpenStreetMap, Southern Ontario.

Runs in GitHub Actions. Downloads Geofabrik's Ontario extract (Ontario only, so
nothing from the United States), keeps trail route relations (hiking / foot /
walking) and path-type ways, crops to the area below Gravenhurst, sorts each
line into a kind the app colours, and writes a vector PMTiles pack:

  bruce   the Bruce Trail main route
  side    side trails (named "... Side Trail"; mostly the Bruce Trail's blue-blazed ones)
  route   other named trail routes (Trans Canada Trail, conservation-area loops, ...)
  path    named paths, bridleways, multi-use paths and rail trails
  minor   unnamed footpaths (shown only close in)

Data © OpenStreetMap contributors, ODbL.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Iterator

from .config import BUILD_DIR, CACHE_DIR

PBF_URL = "https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf"
# Windsor to the Quebec border, Lake Erie's shore to just above Gravenhurst (44.92 N).
TRAILS_BBOX = (-83.2, 41.6, -74.3, 44.95)
TRAILS_FILE = "trails-south.pmtiles"
MINZOOM, MAXZOOM = 7, 14
PATHS_MINZOOM = 11

TAGS = ["name", "highway", "footway", "access", "surface", "operator", "network", "ref", "route", "type", "official_name"]
ROUTES = {"hiking", "foot", "walking"}
PATHS = {"path", "footway", "bridleway", "cycleway", "track"}

_SIDE = re.compile(r"\bside[- ]trail\b", re.I)
_BRUCE = re.compile(r"\bbruce trail\b", re.I)
_INDOOR = re.compile(r"\bunderground path\b|\b(ground|lower|upper|concourse) (floor|level)\b", re.I)


def classify(tags: dict[str, str], is_route: bool) -> str | None:
    """The kind of line to draw, or None to leave it out."""
    name = (tags.get("name") or tags.get("official_name") or "").strip()
    if tags.get("access") in ("private", "no"):
        return None
    # indoor walkways (Toronto's PATH, mall corridors) aren't trails
    if tags.get("indoor") not in (None, "", "no") or tags.get("tunnel") == "building_passage" or _INDOOR.search(name):
        return None
    if is_route:
        if tags.get("route") not in ROUTES:
            return None
        if _SIDE.search(name):
            return "side"
        if _BRUCE.search(name) or _BRUCE.search(tags.get("operator", "")) or _BRUCE.search(tags.get("network", "")):
            return "bruce"
        return "route" if name else None
    hw = tags.get("highway")
    if hw not in PATHS:
        return None
    if hw == "footway" and tags.get("footway") in ("sidewalk", "crossing", "traffic_island", "access_aisle"):
        return None
    if name:
        if _SIDE.search(name):
            return "side"
        if _BRUCE.search(name):
            return "bruce"
        return "path"
    # unnamed: footpaths and bridleways only (no sidewalks, farm tracks or bike lanes)
    return "minor" if hw in ("path", "bridleway") else None


def _props(tags: dict[str, str], kind: str) -> dict[str, Any]:
    out: dict[str, Any] = {"kind": kind}
    for k in ("name", "surface", "operator", "ref", "network"):
        if tags.get(k):
            out[k] = tags[k][:120]
    if kind in ("path", "minor") and tags.get("highway"):
        out["highway"] = tags["highway"]
    return out


def parse_other_tags(s: str | None) -> dict[str, str]:
    """GDAL's OSM driver puts tags it has no column for in an hstore string: "a"=>"b","c"=>"d"."""
    if not s:
        return {}
    return {m.group(1): m.group(2) for m in re.finditer(r'"((?:[^"\\]|\\.)*)"=>"((?:[^"\\]|\\.)*)"', s)}


def features(path: Path, is_route: bool) -> Iterator[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip().lstrip("\x1e")
            if not line:
                continue
            f = json.loads(line)
            p = f.get("properties") or {}
            tags = {k: str(v) for k, v in p.items() if v not in (None, "") and k != "other_tags"}
            tags.update(parse_other_tags(p.get("other_tags")))
            kind = classify(tags, is_route)
            if kind and f.get("geometry"):
                yield {"type": "Feature", "geometry": f["geometry"], "properties": _props(tags, kind)}


def _osmconf(work: Path) -> Path:
    """GDAL's OSM config with the tags we need as columns (others go to other_tags)."""
    src = next(p for p in (Path("/usr/share/gdal/osmconf.ini"), Path("/usr/local/share/gdal/osmconf.ini")) if p.exists())
    text = src.read_text()
    attrs = ",".join(TAGS)
    out = []
    section = ""
    for line in text.splitlines():
        if line.startswith("["):
            section = line.strip("[] ")
        if section in ("lines", "multilinestrings") and line.startswith("attributes="):
            line = f"attributes={attrs}"
        out.append(line)
    conf = work / "osmconf.ini"
    conf.write_text("\n".join(out) + "\n")
    return conf


def _run(cmd: list[str], env: dict[str, str] | None = None) -> None:
    import os

    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, env={**os.environ, **(env or {})})


def build_trails(out_dir: Path = BUILD_DIR / "release") -> Path:
    import requests

    for tool in ("osmium", "ogr2ogr"):
        if not shutil.which(tool):
            raise RuntimeError(f"{tool} is not installed")
    work = CACHE_DIR / "trails"
    work.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    pbf = work / "ontario-latest.osm.pbf"
    if not pbf.exists():
        with requests.get(PBF_URL, stream=True, timeout=1200, headers={"User-Agent": "TimeMapOntario-personal-map-build/0.2"}) as r:
            r.raise_for_status()
            with (work / "dl.part").open("wb") as fh:
                shutil.copyfileobj(r.raw, fh, 1 << 22)
        (work / "dl.part").replace(pbf)
    print(f"trails: Ontario extract {pbf.stat().st_size / 1e6:.0f} MB", flush=True)

    filtered = work / "filtered.osm.pbf"
    _run(["osmium", "tags-filter", "--overwrite", "-o", str(filtered), str(pbf),
          "w/highway=" + ",".join(sorted(PATHS)), "r/route=" + ",".join(sorted(ROUTES))])
    w, s, e, n = TRAILS_BBOX
    south = work / "south.osm.pbf"
    _run(["osmium", "extract", "--overwrite", "--strategy=smart", "-b", f"{w},{s},{e},{n}", "-o", str(south), str(filtered)])

    conf = _osmconf(work)
    env = {"OSM_CONFIG_FILE": str(conf), "OGR_INTERLEAVED_READING": "YES", "OSM_MAX_TMPFILE_SIZE": "2000"}
    lines_json, routes_json = work / "lines.geojsonl", work / "routes.geojsonl"
    for layer, dst in (("lines", lines_json), ("multilinestrings", routes_json)):
        dst.unlink(missing_ok=True)
        _run(["ogr2ogr", "-f", "GeoJSONSeq", str(dst), str(south), layer, "-spat", str(w), str(s), str(e), str(n)], env)

    # Trail routes go in "trails" (drawn from regional zoom); paths in "paths" (from zoom 11).
    routes_out, paths_out = work / "trails.geojsonl", work / "paths.geojsonl"
    counts: dict[str, int] = {}
    with routes_out.open("w", encoding="utf-8") as ro, paths_out.open("w", encoding="utf-8") as po:
        for path, is_route in ((routes_json, True), (lines_json, False)):
            for f in features(path, is_route):
                k = f["properties"]["kind"]
                counts[k] = counts.get(k, 0) + 1
                (ro if k in ("bruce", "side", "route") else po).write(json.dumps(f, ensure_ascii=False) + "\n")
    print("trails: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())), flush=True)
    if not counts.get("bruce"):
        raise RuntimeError("no Bruce Trail lines found; refusing to publish a trails pack without it")

    gpkg = work / "trails.gpkg"
    gpkg.unlink(missing_ok=True)
    _run(["ogr2ogr", "-f", "GPKG", str(gpkg), str(routes_out), "-nln", "trails"])
    _run(["ogr2ogr", "-update", "-f", "GPKG", str(gpkg), str(paths_out), "-nln", "paths"])
    target = out_dir / TRAILS_FILE
    target.unlink(missing_ok=True)
    conf = json.dumps({"trails": {"minzoom": MINZOOM, "maxzoom": MAXZOOM}, "paths": {"minzoom": PATHS_MINZOOM, "maxzoom": MAXZOOM}})
    _run(["ogr2ogr", "-f", "PMTiles", str(target), str(gpkg),
          "-dsco", f"MINZOOM={MINZOOM}", "-dsco", f"MAXZOOM={MAXZOOM}", "-dsco", "NAME=Trails (OpenStreetMap)",
          "-dsco", f"CONF={conf}", "-dsco", "MAX_SIZE=1000000", "-dsco", "SIMPLIFICATION=4", "-dsco", "SIMPLIFICATION_MAX_ZOOM=2"])
    print(f"trails: {target} ({target.stat().st_size / 1e6:.1f} MB)", flush=True)
    for p in (filtered, south, lines_json, routes_json, routes_out, paths_out, gpkg):
        p.unlink(missing_ok=True)
    return target
