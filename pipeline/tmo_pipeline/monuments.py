"""Monuments & battlefields pack from OpenStreetMap, Southern Ontario.

Same Ontario extract and area as the trails. Keeps:

  monument      historic=monument, and memorials built as markers (cairns, obelisks,
                columns, stones, statues, sculptures)
  war_memorial  memorial=war_memorial (cenotaphs and war memorials)
  battlefield   historic=battlefield (drawn as an area when mapped as one, plus a point)

Plain plaques, benches and the like are left out (the Ontario Heritage Trust plaques
have their own layer). Data © OpenStreetMap contributors, ODbL.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from .config import BUILD_DIR, CACHE_DIR
from .trails import TRAILS_BBOX, _osmconf, _run, features_raw, ontario_pbf

MONUMENTS_FILE = "monuments-south.pmtiles"
TAGS = ["name", "historic", "memorial", "inscription", "start_date", "wikipedia", "wikidata", "website", "description", "subject"]
MARKER_MEMORIALS = {"cairn", "obelisk", "column", "stone", "statue", "sculpture", "war_memorial", "monument", "stele"}


def classify(tags: dict[str, str]) -> str | None:
    h = tags.get("historic")
    m = (tags.get("memorial") or "").strip()
    if h == "battlefield":
        return "battlefield"
    if m == "war_memorial":
        return "war_memorial"
    if h == "monument":
        return "monument"
    if h == "memorial" and m in MARKER_MEMORIALS:
        return "monument"
    return None


def props(tags: dict[str, str], kind: str) -> dict[str, Any]:
    out: dict[str, Any] = {"kind": kind}
    for k, n in (("name", 160), ("memorial", 40), ("inscription", 1500), ("start_date", 40), ("wikipedia", 200), ("wikidata", 40),
                 ("website", 300), ("description", 600), ("subject", 160)):
        v = (tags.get(k) or "").strip()
        if v:
            out[k] = v[:n]
    return out


def centroid(geom: dict[str, Any]) -> list[float] | None:
    """Rough centre of a (multi)polygon's outer ring(s): good enough to place a marker."""
    rings = []
    if geom.get("type") == "Polygon":
        rings = [geom["coordinates"][0]]
    elif geom.get("type") == "MultiPolygon":
        rings = [p[0] for p in geom["coordinates"]]
    pts = [pt for r in rings for pt in r[:-1]]
    if not pts:
        return None
    return [round(sum(p[0] for p in pts) / len(pts), 7), round(sum(p[1] for p in pts) / len(pts), 7)]


def build_monuments(out_dir: Path = BUILD_DIR / "release") -> Path:
    for tool in ("osmium", "ogr2ogr"):
        if not shutil.which(tool):
            raise RuntimeError(f"{tool} is not installed")
    work = CACHE_DIR / "monuments"
    work.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    pbf = ontario_pbf()

    filtered = work / "filtered.osm.pbf"
    _run(["osmium", "tags-filter", "--overwrite", "-o", str(filtered), str(pbf), "nwr/historic=memorial,monument,battlefield"])
    w, s, e, n = TRAILS_BBOX
    south = work / "south.osm.pbf"
    _run(["osmium", "extract", "--overwrite", "--strategy=smart", "-b", f"{w},{s},{e},{n}", "-o", str(south), str(filtered)])
    conf = _osmconf(work, ("points", "multipolygons", "lines"), TAGS)
    env = {"OSM_CONFIG_FILE": str(conf), "OGR_INTERLEAVED_READING": "YES"}
    raw = {}
    for layer in ("points", "multipolygons"):
        dst = work / f"{layer}.geojsonl"
        dst.unlink(missing_ok=True)
        _run(["ogr2ogr", "-f", "GeoJSONSeq", str(dst), str(south), layer, "-spat", str(w), str(s), str(e), str(n)], env)
        raw[layer] = dst

    points, areas = work / "monuments.geojsonl", work / "battlefields.geojsonl"
    counts: dict[str, int] = {}
    with points.open("w", encoding="utf-8") as po, areas.open("w", encoding="utf-8") as ao:
        for layer, path in raw.items():
            for geom, tags in features_raw(path):
                kind = classify(tags)
                if not kind:
                    continue
                p = props(tags, kind)
                counts[kind] = counts.get(kind, 0) + 1
                if layer == "points":
                    po.write(json.dumps({"type": "Feature", "geometry": geom, "properties": p}, ensure_ascii=False) + "\n")
                    continue
                c = centroid(geom)
                if c:
                    po.write(json.dumps({"type": "Feature", "geometry": {"type": "Point", "coordinates": c}, "properties": p}, ensure_ascii=False) + "\n")
                if kind == "battlefield":
                    ao.write(json.dumps({"type": "Feature", "geometry": geom, "properties": {"kind": kind, "name": p.get("name", "")}}, ensure_ascii=False) + "\n")
    print("monuments: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())), flush=True)
    if not counts:
        raise RuntimeError("no monuments found")

    gpkg = work / "monuments.gpkg"
    gpkg.unlink(missing_ok=True)
    _run(["ogr2ogr", "-f", "GPKG", str(gpkg), str(points), "-nln", "monuments"])
    if areas.stat().st_size:
        _run(["ogr2ogr", "-update", "-f", "GPKG", str(gpkg), str(areas), "-nln", "battlefields"])
    target = out_dir / MONUMENTS_FILE
    target.unlink(missing_ok=True)
    _run(["ogr2ogr", "-f", "PMTiles", str(target), str(gpkg), "-dsco", "MINZOOM=7", "-dsco", "MAXZOOM=14",
          "-dsco", "NAME=Monuments and battlefields (OpenStreetMap)", "-dsco", "MAX_SIZE=1000000"])
    print(f"monuments: {target} ({target.stat().st_size / 1e6:.2f} MB)", flush=True)
    for p in (filtered, south, points, areas, gpkg, *raw.values()):
        p.unlink(missing_ok=True)
    return target
