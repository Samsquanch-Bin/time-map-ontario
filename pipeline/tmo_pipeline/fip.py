"""Hamilton 1898 fire insurance plan: preparation for hand georeferencing.

``fip-prepare`` (runs in GitHub Actions):
  1. lists every sheet in McMaster's expo item set 269 (Goad, Insurance plan of
     the city of Hamilton, Jan. 1898; rights: "Copyright, public domain");
  2. downloads each original image and writes a preview JPEG with a labelled pixel
     grid (labels are in ORIGINAL image pixels) for reading control points;
  3. asks OpenStreetMap (Overpass API) for named streets in central Hamilton and
     computes their intersections, so control points use today's coordinates.

Outputs go to ``data/research/hamilton-fip/`` on the research-cache branch.
"""
from __future__ import annotations

import io
import itertools
import json
import re
import time
from pathlib import Path
from typing import Any

from .research import RESEARCH_DIR, USER_AGENT

EXPO_API = "https://expo.mcmaster.ca/api"
ITEM_SET = 269
OUT = RESEARCH_DIR / "hamilton-fip"
OVERPASS = "https://overpass-api.de/api/interpreter"
# central Hamilton (the 1898 plan covers the old city)
HAMILTON_BBOX = (43.225, -79.915, 43.280, -79.800)  # south, west, north, east (Overpass order)
PREVIEW_MAX = 1800


def sheet_label(title: str) -> str:
    m = re.search(r"sheet\]?\s*\[?0*(\d+)", title)
    if m:
        return f"sheet-{int(m.group(1)):02d}"
    if "key plan" in title.lower():
        return "key-plan"
    if "symbol" in title.lower():
        return "key-symbols"
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[-30:]


def grid_step(width: int) -> int:
    """Grid spacing in original pixels giving ~10–20 lines across."""
    for step in (100, 200, 250, 500, 1000):
        if width / step <= 20:
            return step
    return 2000


def list_sheets(s) -> list[dict[str, Any]]:
    sheets, page = [], 1
    while True:
        r = s.get(f"{EXPO_API}/items", params={"item_set_id": ITEM_SET, "per_page": 100, "page": page}, timeout=60)
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        for it in batch:
            media_id = (it.get("o:primary_media") or (it.get("o:media") or [{}])[0]).get("o:id")
            rights = " ".join(e.get("@value", "") for e in it.get("dcterms:rights", []))
            sheets.append({"item_id": it["o:id"], "title": it["o:title"], "label": sheet_label(it["o:title"]), "media_id": media_id, "rights": rights})
        page += 1
    return sheets


def media_url(s, media_id: int) -> str:
    m = s.get(f"{EXPO_API}/media/{media_id}", timeout=60).json()
    return m.get("o:original_url") or m.get("o:source") or ""


def make_preview(data: bytes, out: Path) -> dict[str, Any]:
    from PIL import Image, ImageDraw

    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = im.size
    scale = min(1.0, PREVIEW_MAX / max(w, h))
    pv = im.resize((round(w * scale), round(h * scale)))
    d = ImageDraw.Draw(pv)
    step = grid_step(w)
    for x in range(0, w, step):
        X = round(x * scale)
        d.line([(X, 0), (X, pv.height)], fill=(255, 0, 255), width=1)
        d.text((X + 2, 2), str(x), fill=(255, 0, 255))
        d.text((X + 2, pv.height - 12), str(x), fill=(255, 0, 255))
    for y in range(0, h, step):
        Y = round(y * scale)
        d.line([(0, Y), (pv.width, Y)], fill=(0, 160, 255), width=1)
        d.text((2, Y + 2), str(y), fill=(0, 160, 255))
        d.text((pv.width - 40, Y + 2), str(y), fill=(0, 160, 255))
    pv.save(out, quality=85)
    return {"width": w, "height": h, "preview_scale": scale, "grid_step": step}


def street_intersections(s) -> dict[str, list[float]]:
    from shapely.geometry import LineString, MultiPoint, Point
    from shapely.ops import unary_union

    south, west, north, east = HAMILTON_BBOX
    q = f"""[out:json][timeout:120];
way["highway"]["name"]({south},{west},{north},{east});
out geom;"""
    r = s.post(OVERPASS, data={"data": q}, timeout=300)
    r.raise_for_status()
    lines: dict[str, list] = {}
    for el in r.json()["elements"]:
        geom = el.get("geometry")
        if geom and len(geom) > 1:
            lines.setdefault(el["tags"]["name"], []).append(LineString([(p["lon"], p["lat"]) for p in geom]))
    merged = {n: unary_union(ls) for n, ls in lines.items()}
    out: dict[str, list[float]] = {}
    for (a, ga), (b, gb) in itertools.combinations(sorted(merged.items()), 2):
        if not ga.intersects(gb):
            continue
        inter = ga.intersection(gb)
        pts = [inter] if isinstance(inter, Point) else list(getattr(inter, "geoms", []))
        pts = [p for p in pts if isinstance(p, Point)]
        if not pts:
            continue
        c = MultiPoint(pts).centroid if len(pts) > 1 else pts[0]
        # skip pairs meeting in several far-apart places (ambiguous)
        if len(pts) > 1 and max(p.distance(c) for p in pts) > 0.0015:
            continue
        out[f"{a} & {b}"] = [round(c.x, 7), round(c.y, 7)]
    return out


def prepare() -> None:
    import requests

    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "previews").mkdir(exist_ok=True)
    sheets = list_sheets(s)
    print(f"{len(sheets)} sheets")
    for sh in sheets:
        try:
            url = media_url(s, sh["media_id"])
            sh["original_url"] = url
            data = s.get(url, timeout=300).content
            sh.update(make_preview(data, OUT / "previews" / f"{sh['label']}.jpg"))
            sh["bytes"] = len(data)
            print(f"{sh['label']}: {sh['width']}x{sh['height']} {url}")
        except Exception as exc:  # noqa: BLE001
            sh["error"] = str(exc)[:300]
            print(f"{sh['label']}: ERROR {exc}")
        time.sleep(1)
    (OUT / "sheets.json").write_text(json.dumps(sheets, indent=1, ensure_ascii=False))
    try:
        inter = street_intersections(s)
        (OUT / "intersections.json").write_text(json.dumps(inter, indent=0, ensure_ascii=False, sort_keys=True))
        print(f"{len(inter)} intersections")
    except Exception as exc:  # noqa: BLE001
        print(f"intersections failed: {exc}")
