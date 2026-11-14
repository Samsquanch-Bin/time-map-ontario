"""Researched places of interest and Indigenous settlements.

Each place is ``data/places/<id>.md``: YAML front matter + a short story. Example::

    ---
    id: battle-of-stoney-creek
    title: Battle of Stoney Creek
    category: battle            # battle | mill | lost-village | indigenous | settlers
    date: {start: 1813, end: 1813, label: "6 June 1813"}
    location:
      lon: -79.7651
      lat: 43.2186
      precision: exact          # exact | approximate | area
      radius_m: 0               # approximate/area: drawn as a shaded circle of this radius
      basis: "Wikidata Q123 coordinates (P625)"
    nation: ""                  # Indigenous entries: the people/Nation named by the sources
    sources:
      - {title: "...", url: "https://...", licence: "CC BY-SA 4.0", retrieved: "2026-11-14"}
    researched_by: "Claude (unreviewed)"
    sample: false
    ---
    Story text written only from the listed sources.

The pipeline validates every file and writes ``places.json`` for the app. Area-type
locations are turned into polygons here so the phone doesn't compute geometry.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .config import FOCUS_BBOX, REPO_DIR

PLACES_DIR = REPO_DIR / "data" / "places"
CATEGORIES = ("battle", "mill", "lost-village", "indigenous", "settlers")
PRECISIONS = ("exact", "approximate", "area")
MIN_WORDS, MAX_WORDS = 25, 260


class PlaceError(ValueError):
    pass


@dataclass(frozen=True)
class Place:
    meta: dict[str, Any]
    body: str

    @property
    def id(self) -> str:
        return self.meta["id"]


def split_front_matter(text: str, origin: str = "<place>") -> tuple[dict[str, Any], str]:
    m = re.match(r"\A---\s*\n(.*?)\n---\s*\n(.*)\Z", text, re.S)
    if not m:
        raise PlaceError(f"{origin}: must start with YAML front matter between --- lines")
    meta = yaml.safe_load(m.group(1)) or {}
    return meta, m.group(2).strip()


def validate_place(meta: dict[str, Any], body: str, origin: str = "<place>") -> None:
    def fail(msg: str) -> None:
        raise PlaceError(f"{origin}: {msg}")

    for key in ("id", "title", "category", "date", "location", "sources", "researched_by"):
        if not meta.get(key):
            fail(f"missing {key}")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", str(meta["id"])):
        fail("id must be lowercase letters, digits and dashes")
    if meta["category"] not in CATEGORIES:
        fail(f"category must be one of {CATEGORIES}")
    date = meta["date"]
    try:
        start, end = int(date["start"]), int(date.get("end", date["start"]))
    except (KeyError, TypeError, ValueError):
        fail("date needs integer start (and optional end) years")
    if not (1000 <= start <= end <= 2100):
        fail("date range implausible")
    loc = meta["location"]
    for k in ("lon", "lat", "precision", "basis"):
        if loc.get(k) in (None, ""):
            fail(f"location.{k} required (basis = where the coordinates come from)")
    if loc["precision"] not in PRECISIONS:
        fail(f"location.precision must be one of {PRECISIONS}")
    if loc["precision"] != "exact" and not loc.get("radius_m"):
        fail("approximate/area locations need radius_m")
    if not (-95.2 <= float(loc["lon"]) <= -74.3 and 41.6 <= float(loc["lat"]) <= 56.9):
        fail("location is outside Ontario")
    sources = meta["sources"]
    if not isinstance(sources, list) or not sources:
        fail("at least one source required")
    for s in sources:
        if not (s.get("title") and str(s.get("url", "")).startswith("http") and s.get("retrieved")):
            fail(f"each source needs title, url and retrieved date: {s}")
    if meta["category"] == "indigenous" and not meta.get("nation"):
        fail("indigenous entries must name the people/Nation given by the sources")
    words = len(body.split())
    if not (MIN_WORDS <= words <= MAX_WORDS):
        fail(f"story has {words} words; keep it between {MIN_WORDS} and {MAX_WORDS}")


def load_places(directory: Path = PLACES_DIR) -> list[Place]:
    out = []
    ids = set()
    for path in sorted(directory.glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        meta, body = split_front_matter(path.read_text(encoding="utf-8"), path.name)
        validate_place(meta, body, path.name)
        if meta["id"] != path.stem:
            raise PlaceError(f"{path.name}: id must match file name")
        if meta["id"] in ids:
            raise PlaceError(f"duplicate id {meta['id']}")
        ids.add(meta["id"])
        out.append(Place(meta, body))
    return out


def circle_polygon(lon: float, lat: float, radius_m: float, steps: int = 48) -> dict[str, Any]:
    """Approximate circle as a GeoJSON Polygon (good enough at these latitudes)."""
    dlat = radius_m / 111_320.0
    dlon = radius_m / (111_320.0 * math.cos(math.radians(lat)))
    ring = [
        [round(lon + dlon * math.cos(2 * math.pi * i / steps), 6), round(lat + dlat * math.sin(2 * math.pi * i / steps), 6)]
        for i in range(steps)
    ]
    ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def to_app_record(p: Place) -> dict[str, Any]:
    m = p.meta
    loc = m["location"]
    lon, lat = float(loc["lon"]), float(loc["lat"])
    rec = {
        "id": m["id"],
        "title": m["title"],
        "category": m["category"],
        "start": int(m["date"]["start"]),
        "end": int(m["date"].get("end", m["date"]["start"])),
        "date_label": str(m["date"].get("label", "")),
        "lon": lon,
        "lat": lat,
        "precision": loc["precision"],
        "location_basis": loc["basis"],
        "radius_m": int(loc.get("radius_m") or 0),
        "nation": m.get("nation", ""),
        "story": p.body,
        "sources": m["sources"],
        "researched_by": m["researched_by"],
        "sample": bool(m.get("sample", False)),
        "in_focus_area": FOCUS_BBOX[0] <= lon <= FOCUS_BBOX[2] and FOCUS_BBOX[1] <= lat <= FOCUS_BBOX[3],
    }
    if loc["precision"] != "exact":
        rec["area"] = circle_polygon(lon, lat, rec["radius_m"])
    return rec


def build_places_json(places: list[Place], release: bool = False) -> dict[str, Any]:
    if release:
        samples = [p.id for p in places if p.meta.get("sample")]
        if samples:
            raise PlaceError(f"sample entries cannot ship in a release build: {samples}")
    return {"version": 1, "places": [to_app_record(p) for p in places]}
