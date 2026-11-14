"""Command line: ``python -m tmo_pipeline <command>``.

Commands
  validate          check all manifests and overlay definitions
  sources-md        regenerate SOURCES.md from the manifests
  basemap           extract the Southern Ontario basemap (needs pmtiles CLI + network)
  overlay ID|all    build historical overlay(s) (needs GDAL + pmtiles CLI + network)
  catalog           write build/release/catalog.json from what has been built
  research-discover list candidate places in the focus area from Wikidata (needs network)
  research-fetch    retrieve sources for data/research/candidates.yaml (needs network)
  maps-discover     list georeferenced map services on known ArcGIS servers (needs network)
"""
from __future__ import annotations

import argparse
import json
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
    ov = sub.add_parser("overlay")
    ov.add_argument("id")
    cat = sub.add_parser("catalog")
    cat.add_argument("--release", action="store_true", help="refuse sample data")
    sub.add_parser("research-discover")
    sub.add_parser("research-fetch")
    sub.add_parser("maps-discover")
    sub.add_parser("fetch-pages")
    args = p.parse_args(argv)

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
    elif args.cmd == "basemap":
        from .basemap import build_basemap

        print(build_basemap())
    elif args.cmd == "overlay":
        from .overlays import build_overlay

        ids = [o for o in overlays if not overlays[o].live] if args.id == "all" else [args.id]
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
        catalog = build_catalog(release, BUILD_DIR / "overlay-meta", overlays, sources, release=args.release)
        release.mkdir(parents=True, exist_ok=True)
        (release / "catalog.json").write_text(json.dumps(catalog, indent=1))
        print(f"catalog: {len(catalog['packs'])} packs, {len(catalog['overlays'])} overlays")
    return 0


if __name__ == "__main__":
    sys.exit(main())
