import json

import pytest

from tmo_pipeline.catalog import CatalogError, build_catalog
from tmo_pipeline.manifests import load_manifests
from tmo_pipeline.overlays import parse_overlay

FOOT = {"type": "MultiPolygon", "coordinates": [[[[-79.2, 43.0], [-79.0, 43.0], [-79.0, 43.2], [-79.2, 43.2], [-79.2, 43.0]]]]}


def _setup(tmp_path, sample=False):
    release = tmp_path / "release"
    meta = tmp_path / "meta"
    release.mkdir()
    meta.mkdir()
    (release / "basemap-south.pmtiles").write_bytes(b"x" * 100)
    (release / "overlay-t.pmtiles").write_bytes(b"y" * 50)
    (meta / "t.json").write_text(json.dumps({"file": "overlay-t.pmtiles", "minzoom": 8, "maxzoom": 15, "bounds": [-79.2, 43.0, -79.0, 43.2], "footprint": FOOT}))
    ov = parse_overlay({
        "id": "t", "title": "T", "year": 1826, "source": "brock_early_niagara",
        "fetch": {"method": "arcgis_imageserver", "url": "https://x"}, "accuracy_note": "approx", "sample": sample,
    })
    return release, meta, {"t": ov}


def test_catalog_builds_and_validates(tmp_path):
    release, meta, ovs = _setup(tmp_path)
    cat = build_catalog(release, meta, ovs, load_manifests())
    assert [p["kind"] for p in cat["packs"]] == ["basemap", "overlay"]
    assert cat["overlays"][0]["era"] == [1826, 1826]
    ids = {a["source_id"] for a in cat["attributions"]}
    assert {"openstreetmap", "brock_early_niagara", "esri_world_imagery"} <= ids
    assert all(len(p["sha256"]) == 64 for p in cat["packs"])


def test_release_refuses_sample_overlays(tmp_path):
    release, meta, ovs = _setup(tmp_path, sample=True)
    build_catalog(release, meta, ovs, load_manifests())  # fine in a dev build
    with pytest.raises(CatalogError, match="sample"):
        build_catalog(release, meta, ovs, load_manifests(), release=True)


def test_unbuilt_overlay_skipped(tmp_path):
    release, meta, ovs = _setup(tmp_path)
    (meta / "t.json").unlink()
    cat = build_catalog(release, meta, ovs, load_manifests())
    assert cat["overlays"] == []


def test_live_overlay_has_tiles_not_file(tmp_path):
    release, meta, ovs = _setup(tmp_path)
    live = parse_overlay({
        "id": "live1", "title": "L", "year": 1880, "source": "brock_early_niagara",
        "fetch": {"method": "live_tiles", "url": "https://x/tile/{z}/{y}/{x}"}, "accuracy_note": "a",
        "bounds": [-79.5, 43.6, -79.3, 43.7], "maxzoom": 19, "minzoom": 13,
    })
    cat = build_catalog(release, meta, {**ovs, "live1": live}, load_manifests())
    entry = next(o for o in cat["overlays"] if o["id"] == "live1")
    assert "file" not in entry and entry["tiles"].startswith("https://")
    assert len(cat["packs"]) == 2  # live overlays add no pack


def test_live_overlay_validation():
    from tmo_pipeline.overlays import OverlayError

    base = {"id": "l", "title": "L", "year": 1880, "source": "s", "accuracy_note": "a", "maxzoom": 19,
            "fetch": {"method": "live_tiles", "url": "https://x/tile/{z}/{y}/{x}"}}
    with pytest.raises(OverlayError, match="bounds"):
        parse_overlay(base)
    with pytest.raises(OverlayError, match="url"):
        parse_overlay({**base, "bounds": [0, 0, 1, 1], "fetch": {"method": "live_tiles", "url": "https://x/a.png"}})


def test_failed_overlay_keeps_published_pack(tmp_path):
    release, meta, ovs = _setup(tmp_path)
    previous = build_catalog(release, meta, ovs, load_manifests())
    (meta / "t.json").unlink()
    (release / "overlay-t.pmtiles").unlink()
    cat = build_catalog(release, meta, ovs, load_manifests(), previous=previous)
    (entry,) = cat["overlays"]
    assert entry["file"] == "overlay-t.pmtiles" and "tiles" not in entry
    assert "overlay-t.pmtiles" in {p["file"] for p in cat["packs"]}


def test_failed_imageserver_overlay_falls_back_to_live(tmp_path):
    release, meta, _ = _setup(tmp_path)
    (meta / "t.json").unlink()
    ov = parse_overlay({
        "id": "t", "title": "T", "year": 1826, "source": "brock_early_niagara",
        "fetch": {"method": "arcgis_imageserver", "url": "https://x/ImageServer/", "nodata": 255},
        "accuracy_note": "approx", "bounds": [-79.2, 43.0, -79.0, 43.2], "minzoom": 12,
    })
    cat = build_catalog(release, meta, {"t": ov}, load_manifests(), previous={"overlays": [], "packs": []})
    (entry,) = cat["overlays"]
    assert "file" not in entry
    assert entry["tiles"].startswith("https://x/ImageServer/exportImage?bbox={bbox-epsg-3857}")
    assert "noData=255" in entry["tiles"]
    assert entry["minzoom"] == 12 and entry["maxzoom"] == 18
    assert "needs internet" in entry["description"]
