"""Build catalog.json: the single index the app downloads first.

It lists the data pack files (with size and sha256 so the app can tell what's
new), the historical overlays with their metadata, and the attributions for
every source in use.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any

from .config import DATA_RELEASE_BASE_URL, FOCUS_BBOX, MAX_RELEASE_ASSET_BYTES, SCHEMAS_DIR, SOUTH_BBOX
from .manifests import Source, require_sources
from .overlays import OverlayDef

CATALOG_VERSION = 1
BASEMAP_SOURCES = ["openstreetmap", "protomaps_basemap", "protomaps_assets"]


class CatalogError(ValueError):
    pass


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pack_entry(path: Path, kind: str) -> dict[str, Any]:
    size = path.stat().st_size
    if size > MAX_RELEASE_ASSET_BYTES:
        raise CatalogError(f"{path.name} is {size} bytes; GitHub release assets must be under 2 GiB")
    return {
        "file": path.name,
        "kind": kind,
        "bytes": size,
        "sha256": sha256_file(path),
        "url": f"{DATA_RELEASE_BASE_URL}/{path.name}",
    }


def live_meta(ov: OverlayDef) -> dict[str, Any]:
    w, s, e, n = ov.bounds  # type: ignore[misc]
    return {
        "tiles": ov.fetch["url"],
        "minzoom": ov.minzoom,
        "maxzoom": ov.maxzoom,
        "bounds": [w, s, e, n],
        "footprint": {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]},
        "source_url": ov.fetch.get("service", ov.fetch["url"]),
    }


def overlay_entry(ov: OverlayDef, meta: dict[str, Any], src: Source) -> dict[str, Any]:
    entry = {
        "id": ov.id,
        "title": ov.title,
        "year": ov.year,
        "era": list(ov.era),
        "description": ov.description,
        "accuracy_note": ov.accuracy_note
        + (
            f" Measured: the sheets' control points fit today's street corners to within about {meta['measured_rmse_m']} m (RMSE)."
            if meta.get("measured_rmse_m") is not None
            else ""
        ),
        "minzoom": meta["minzoom"],
        "maxzoom": meta["maxzoom"],
        "bounds": meta["bounds"],
        "footprint": meta["footprint"],
        "source_id": src.id,
        "source_url": meta.get("source_url", src.data_url),
        "licence": src.licence,
        "licence_status": src.licence_check.status,
        "source_item_licence": meta.get("source_item_licence", ""),
        "attribution": src.attribution,
        "sample": ov.sample,
    }
    if ov.live:
        entry["tiles"] = meta["tiles"]
        entry["tile_size"] = int(ov.fetch.get("tile_size", 256))
    else:
        entry["file"] = meta["file"]
    return entry


def build_catalog(
    release_dir: Path,
    meta_dir: Path,
    overlays: dict[str, OverlayDef],
    sources: dict[str, Source],
    release: bool = False,
    now: dt.datetime | None = None,
    places_sources: tuple[str, ...] = ("wikipedia", "wikidata"),
) -> dict[str, Any]:
    packs = []
    used_sources: set[str] = set(BASEMAP_SOURCES) | {"esri_world_imagery", "openfreemap"}
    require_sources(sorted(used_sources), sources)

    basemap = release_dir / "basemap-south.pmtiles"
    if basemap.exists():
        packs.append(pack_entry(basemap, "basemap"))

    overlay_entries = []
    for ov in sorted(overlays.values(), key=lambda o: (o.year, o.id)):
        if release and ov.sample:
            raise CatalogError(f"overlay {ov.id} is marked sample: true and cannot ship in a release build")
        if ov.live:
            (src,) = require_sources([ov.source], sources)
            used_sources.add(src.id)
            overlay_entries.append(overlay_entry(ov, live_meta(ov), src))
            continue
        meta_path = meta_dir / f"{ov.id}.json"
        if not meta_path.exists():
            print(f"skipping overlay {ov.id}: not built")
            continue
        if release and ov.sample:
            raise CatalogError(f"overlay {ov.id} is marked sample: true and cannot ship in a release build")
        (src,) = require_sources([ov.source], sources)
        used_sources.add(src.id)
        meta = json.loads(meta_path.read_text())
        overlay_entries.append(overlay_entry(ov, meta, src))
        packs.append(pack_entry(release_dir / meta["file"], "overlay"))

    places = release_dir / "places.json"
    if places.exists():
        packs.append(pack_entry(places, "places"))
        require_sources(list(places_sources), sources)
        used_sources.update(places_sources)

    attributions = [
        {
            "source_id": s.id,
            "name": s.name,
            "text": s.attribution,
            "licence": s.licence,
            "licence_url": s.licence_url,
            "licence_status": s.licence_check.status,
            "homepage": s.homepage,
        }
        for s in sorted((sources[i] for i in used_sources), key=lambda s: s.id)
    ]
    catalog = {
        "version": CATALOG_VERSION,
        "generated_at": (now or dt.datetime.now(dt.timezone.utc)).replace(microsecond=0).isoformat(),
        "focus_bbox": list(FOCUS_BBOX),
        "basemap_bbox": list(SOUTH_BBOX),
        "packs": packs,
        "overlays": overlay_entries,
        "attributions": attributions,
    }
    validate_catalog(catalog)
    return catalog


def validate_catalog(catalog: dict[str, Any]) -> None:
    import jsonschema

    schema = json.loads((SCHEMAS_DIR / "catalog.schema.json").read_text())
    jsonschema.validate(catalog, schema)
    files = [p["file"] for p in catalog["packs"]]
    if len(files) != len(set(files)):
        raise CatalogError("duplicate pack file names")
    for ov in catalog["overlays"]:
        if "file" in ov and ov["file"] not in files:
            raise CatalogError(f"overlay {ov['id']} points at {ov['file']}, which is not in packs")
