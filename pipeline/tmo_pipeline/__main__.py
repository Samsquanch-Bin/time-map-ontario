"""Command line: ``python -m tmo_pipeline <command>``.

Commands
  validate          check all manifests and overlay definitions
  sources-md        regenerate SOURCES.md from the manifests
  basemap           extract the Southern Ontario basemap (needs pmtiles CLI + network)
  terrain           copy the elevation tiles for hill shading (needs pmtiles CLI + network)
  overlay ID|all    build historical overlay(s) (needs GDAL + pmtiles CLI + network)
  catalog           write build/release/catalog.json from what has been built
  research-discover list candidate places in the focus area from Wikidata (needs network)
  research-fetch    retrieve sources for data/research/candidates.yaml (needs network)
  maps-discover     list georeferenced map services on known ArcGIS servers (needs network)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .config import BUILD_DIR, REPO_DIR
from .manifests import load_manifests, require_sources
from .overlays import load_overlays


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="tmo_pipeline")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("validate")  # also validates data/places
    sm = sub.add_parser("sources-md")
    sm.add_argument("--check", action="store_true", help="fail if SOURCES.md is out of date")
    sub.add_parser("basemap")
    sub.add_parser("terrain")
    sub.add_parser("trails")
    ov = sub.add_parser("overlay")
    ov.add_argument("id")
    ov.add_argument("--previous", type=Path, help="the published catalog.json: with 'all', skip overlays whose published pack was built from the same definition")
    cat = sub.add_parser("catalog")
    cat.add_argument("--release", action="store_true", help="refuse sample data")
    cat.add_argument("--previous", type=Path, help="the published catalog.json: overlays that failed to build keep their pack from it")
    sub.add_parser("research-discover")
    sub.add_parser("research-fetch")
    sub.add_parser("maps-discover")
    sub.add_parser("fetch-pages")
    sub.add_parser("fip-prepare")
    sub.add_parser("probe")
    sub.add_parser("plaques-check")
    args = p.parse_args(argv)

    if args.cmd == "plaques-check":
        from .plaques_check import run as check

        check()
        return 0
    if args.cmd == "probe":
        from .probe import run as probe

        probe()
        return 0
    if args.cmd == "fip-prepare":
        import os

        from .fip import prepare

        prepare({x for x in os.environ.get("FIP_HALF", "").split(",") if x})
        return 0

    if args.cmd == "fetch-pages":
        from .webfetch import run

        run()
        return 0

    if args.cmd == "maps-discover":
        from .map_discovery import discover

        discover()
        return 0

    if args.cmd.startswith("research-"):
        from . import research

        if args.cmd == "research-discover":
            research.discover()
        else:
            research.fetch(research.load_candidates())
        return 0

    sources = load_manifests()
    overlays = load_overlays()

    if args.cmd == "validate":
        for o in overlays.values():
            require_sources([o.source], sources)
        from .places import load_places

        print(f"ok: {len(sources)} sources, {len(overlays)} overlays, {len(load_places())} places")
    elif args.cmd == "sources-md":
        from .sources_md import render

        text = render(sources)
        path = REPO_DIR / "SOURCES.md"
        if args.check:
            if not path.exists() or path.read_text() != text:
                print("SOURCES.md is out of date: run python -m tmo_pipeline sources-md", file=sys.stderr)
                return 1
            print("SOURCES.md is up to date")
        else:
            path.write_text(text)
            print(f"wrote {path}")
    elif args.cmd == "trails":
        from .trails import build_trails

        print(build_trails())
    elif args.cmd == "terrain":
        from .terrain import build_terrain

        print(build_terrain())
    elif args.cmd == "basemap":
        from .basemap import build_basemap

        print(build_basemap())
    elif args.cmd == "overlay":
        from .overlays import build_overlay, definition_hash

        ids = [o for o in overlays if not overlays[o].live] if args.id == "all" else [args.id]
        if args.id == "all" and args.previous and args.previous.exists():
            prev = json.loads(args.previous.read_text())
            prev_files = {pk["file"] for pk in prev.get("packs", [])}
            unchanged = {
                o["id"] for o in prev.get("overlays", [])
                if o.get("file") in prev_files and o["id"] in overlays and o.get("def_hash") == definition_hash(overlays[o["id"]])
            }
            for oid in sorted(unchanged):
                print(f"overlay {oid}: unchanged since it was published; keeping that pack")
            ids = [o for o in ids if o not in unchanged]
        failed: list[str] = []
        for oid in ids:
            if oid not in overlays:
                print(f"unknown overlay {oid}", file=sys.stderr)
                return 2
            require_sources([overlays[oid].source], sources)
            try:
                build_overlay(overlays[oid])
            except Exception as exc:  # one bad map shouldn't sink the whole data build
                if args.id != "all":
                    raise
                failed.append(oid)
                print(f"::warning::overlay {oid} failed and is skipped: {exc}", flush=True)
        if failed and len(failed) == len(ids):
            print("every overlay failed", file=sys.stderr)
            return 1
    elif args.cmd == "catalog":
        from .catalog import build_catalog

        from .places import build_places_json, load_places

        release = BUILD_DIR / "release"
        release.mkdir(parents=True, exist_ok=True)
        places = load_places()
        places_path = release / "places.json"
        if places:
            places_path.write_text(json.dumps(build_places_json(places, release=args.release), ensure_ascii=False))
            print(f"places: {len(places)}")
        else:
            places_path.unlink(missing_ok=True)
        previous = None
        if args.previous and args.previous.exists():
            previous = json.loads(args.previous.read_text())
        catalog = build_catalog(release, BUILD_DIR / "overlay-meta", overlays, sources, release=args.release, previous=previous)
        release.mkdir(parents=True, exist_ok=True)
        (release / "catalog.json").write_text(json.dumps(catalog, indent=1))
        print(f"catalog: {len(catalog['packs'])} packs, {len(catalog['overlays'])} overlays")
    return 0


if __name__ == "__main__":
    sys.exit(main())
