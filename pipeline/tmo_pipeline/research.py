"""Source retrieval for researched places (milestones d and e).

Two steps, both run in GitHub Actions (which can reach Wikidata and Wikipedia):

``discover``  Asks Wikidata for items with published coordinates inside the focus
              area that belong to the topics (battles, forts, mills, lost villages,
              archaeological / Indigenous sites, pioneer villages). Writes
              ``data/research/discovered.json``.
``fetch``     For each item listed in ``data/research/candidates.yaml``, retrieves
              the Wikidata statements (coordinates, dates) and the plain-text
              English Wikipedia article at a fixed revision. Writes one JSON file
              per item to ``data/research/sources/``.

Place entries in ``data/places/`` are then written only from these retrieved
texts, citing the exact revision, so nothing comes from memory.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import time
from pathlib import Path
from typing import Any

import yaml

from .config import FOCUS_BBOX, REPO_DIR

RESEARCH_DIR = REPO_DIR / "data" / "research"
USER_AGENT = "TimeMapOntario-personal-research/0.1 (https://github.com/Samsquanch-Bin/time-map-ontario)"
SPARQL_URL = "https://query.wikidata.org/sparql"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

# topic -> Wikidata classes (instances of these or their subclasses)
TOPIC_CLASSES: dict[str, list[str]] = {
    "battle": ["Q178561", "Q188055"],  # battle, siege
    "fort": ["Q1785071", "Q57821"],  # fort, fortification
    "mill": ["Q44494", "Q185187"],  # mill, watermill
    "lost-village": ["Q74047", "Q350895", "Q19953632"],  # ghost town, abandoned village, former settlement
    "indigenous-site": ["Q839954"],  # archaeological site
    "pioneer-village": ["Q756102"],  # open-air museum
}


def sparql_query(topic: str, bbox: tuple[float, float, float, float] = FOCUS_BBOX) -> str:
    if topic not in TOPIC_CLASSES:
        raise ValueError(f"unknown topic {topic}")
    w, s, e, n = bbox
    classes = " ".join(f"wd:{q}" for q in TOPIC_CLASSES[topic])
    return f"""
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?article WHERE {{
  SERVICE wikibase:box {{
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point({w} {s})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point({e} {n})"^^geo:wktLiteral .
  }}
  VALUES ?class {{ {classes} }}
  ?item wdt:P31/wdt:P279* ?class .
  OPTIONAL {{ ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
}}
LIMIT 500
""".strip()


def parse_point(wkt: str) -> tuple[float, float]:
    m = re.fullmatch(r"\s*Point\(\s*([-0-9.eE]+)\s+([-0-9.eE]+)\s*\)\s*", wkt)
    if not m:
        raise ValueError(f"not a WKT point: {wkt!r}")
    return float(m.group(1)), float(m.group(2))


def parse_sparql_rows(topic: str, data: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for b in data["results"]["bindings"]:
        lon, lat = parse_point(b["coord"]["value"])
        article = b.get("article", {}).get("value", "")
        out.append(
            {
                "qid": b["item"]["value"].rsplit("/", 1)[-1],
                "label": b.get("itemLabel", {}).get("value", ""),
                "description": b.get("itemDescription", {}).get("value", ""),
                "lon": lon,
                "lat": lat,
                "topic": topic,
                "wikipedia": article,
            }
        )
    return out


def _session():
    import requests

    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    return s


def discover(out: Path = RESEARCH_DIR / "discovered.json") -> list[dict[str, Any]]:
    s = _session()
    seen: dict[str, dict[str, Any]] = {}
    for topic in TOPIC_CLASSES:
        r = s.get(SPARQL_URL, params={"query": sparql_query(topic), "format": "json"}, timeout=120)
        r.raise_for_status()
        for row in parse_sparql_rows(topic, r.json()):
            if row["qid"] in seen:
                seen[row["qid"]].setdefault("also_topics", []).append(topic)
            else:
                seen[row["qid"]] = row
        time.sleep(2)
    items = sorted(seen.values(), key=lambda r: (r["topic"], r["label"]))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"retrieved": dt.date.today().isoformat(), "bbox": FOCUS_BBOX, "items": items}, indent=1, ensure_ascii=False))
    print(f"discovered {len(items)} items")
    return items


def load_candidates(path: Path = RESEARCH_DIR / "candidates.yaml") -> list[dict[str, Any]]:
    data = yaml.safe_load(path.read_text()) or {}
    cands = data.get("candidates", [])
    for c in cands:
        if not (c.get("qid") or c.get("wikipedia")):
            raise ValueError(f"candidate needs qid or wikipedia title: {c}")
    return cands


def _claim_values(entity: dict[str, Any], prop: str) -> list[Any]:
    vals = []
    for claim in entity.get("claims", {}).get(prop, []):
        snak = claim.get("mainsnak", {})
        if snak.get("snaktype") == "value":
            vals.append(snak["datavalue"]["value"])
    return vals


def summarise_entity(entity: dict[str, Any]) -> dict[str, Any]:
    """Pull out the statements we use: coordinates and dates."""
    coords = [{"lon": v["longitude"], "lat": v["latitude"], "precision_deg": v.get("precision")} for v in _claim_values(entity, "P625")]
    dates = {}
    for prop, name in (("P585", "point_in_time"), ("P580", "start_time"), ("P582", "end_time"), ("P571", "inception"), ("P576", "dissolved")):
        vals = [v["time"] for v in _claim_values(entity, prop)]
        if vals:
            dates[name] = vals
    return {
        "label": entity.get("labels", {}).get("en", {}).get("value", ""),
        "description": entity.get("descriptions", {}).get("en", {}).get("value", ""),
        "coordinates": coords,
        "dates": dates,
        "enwiki": entity.get("sitelinks", {}).get("enwiki", {}).get("title", ""),
    }


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80]


def fetch(candidates: list[dict[str, Any]], out_dir: Path = RESEARCH_DIR / "sources") -> None:
    s = _session()
    out_dir.mkdir(parents=True, exist_ok=True)
    for c in candidates:
        record: dict[str, Any] = {"candidate": c, "retrieved": dt.date.today().isoformat()}
        title = c.get("wikipedia", "")
        if c.get("qid"):
            r = s.get(WIKIDATA_API, params={"action": "wbgetentities", "ids": c["qid"], "format": "json", "props": "labels|descriptions|claims|sitelinks"}, timeout=60)
            r.raise_for_status()
            ent = r.json()["entities"][c["qid"]]
            record["wikidata"] = summarise_entity(ent) | {"url": f"https://www.wikidata.org/wiki/{c['qid']}", "licence": "CC0 1.0"}
            title = title or record["wikidata"]["enwiki"]
        if title:
            r = s.get(
                WIKIPEDIA_API,
                params={"action": "query", "prop": "extracts|revisions|coordinates", "explaintext": 1, "titles": title, "redirects": 1, "rvprop": "ids|timestamp", "format": "json", "formatversion": 2},
                timeout=60,
            )
            r.raise_for_status()
            page = r.json()["query"]["pages"][0]
            if page.get("missing"):
                # Title didn't match: take the top search hit, and record that we did.
                sr = s.get(WIKIPEDIA_API, params={"action": "query", "list": "search", "srsearch": title, "srlimit": 1, "format": "json"}, timeout=60).json()
                hits = sr.get("query", {}).get("search", [])
                if hits:
                    record["wikipedia_search"] = {"query": title, "used_title": hits[0]["title"]}
                    r = s.get(
                        WIKIPEDIA_API,
                        params={"action": "query", "prop": "extracts|revisions|coordinates", "explaintext": 1, "titles": hits[0]["title"], "redirects": 1, "rvprop": "ids|timestamp", "format": "json", "formatversion": 2},
                        timeout=60,
                    )
                    r.raise_for_status()
                    page = r.json()["query"]["pages"][0]
            if not page.get("missing"):
                rev = page["revisions"][0]
                record["wikipedia"] = {
                    "title": page["title"],
                    "revid": rev["revid"],
                    "timestamp": rev["timestamp"],
                    "url": f"https://en.wikipedia.org/w/index.php?title={page['title'].replace(' ', '_')}&oldid={rev['revid']}",
                    "licence": "CC BY-SA 4.0",
                    "coordinates": page.get("coordinates", []),
                    "text": page.get("extract", ""),
                }
        name = slugify(c.get("id") or title or c.get("qid"))
        (out_dir / f"{name}.json").write_text(json.dumps(record, indent=1, ensure_ascii=False))
        print(f"fetched {name}: wikipedia={'wikipedia' in record} wikidata={'wikidata' in record}")
        time.sleep(1)
