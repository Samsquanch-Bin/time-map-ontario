import pytest

from tmo_pipeline.manifests import load_manifests, require_sources
from tmo_pipeline.overlays import (
    OverlayError,
    geojson_bounds,
    load_overlays,
    merge_polygons,
    parse_overlay,
    plan_export_windows,
    zoom_for_resolution,
)

BASE = {
    "id": "t",
    "title": "T",
    "year": 1858,
    "source": "s",
    "fetch": {"method": "arcgis_imageserver", "url": "https://x/ImageServer"},
    "accuracy_note": "approx",
}


def test_windows_cover_extent_exactly():
    wins = plan_export_windows((0, 0, 10_000, 5_000), (1.0, 1.0), (4000, 4000))
    assert len(wins) == 3 * 2
    assert sum(w["size"][0] for w in wins if w["row"] == 0) == 10_000
    assert sum(w["size"][1] for w in wins if w["col"] == 0) == 5_000
    first = wins[0]
    assert first["bbox"] == (0, 1_000, 4_000, 5_000)  # top-left window
    last = wins[-1]
    assert last["bbox"] == (8_000, 0, 10_000, 1_000)


def test_windows_single_when_small():
    wins = plan_export_windows((100, 200, 300, 400), (2.0, 2.0), (4000, 4000))
    assert len(wins) == 1 and wins[0]["size"] == (100, 100)


@pytest.mark.parametrize("extent", [(0, 0, 0, 1), (5, 5, 1, 1)])
def test_windows_reject_empty(extent):
    with pytest.raises(OverlayError):
        plan_export_windows(extent, (1, 1), (10, 10))


def test_zoom_for_resolution():
    # ~2.4 m/px at 43.5° N needs z16 (z16 ≈ 1.73 m/px there).
    assert zoom_for_resolution(2.4, 43.5) == 16
    assert zoom_for_resolution(1000, 43.5) <= 8


def test_parse_overlay_validation():
    assert parse_overlay(BASE).era == (1858, 1858)
    with pytest.raises(OverlayError):
        parse_overlay(dict(BASE, year=3000))
    with pytest.raises(OverlayError):
        parse_overlay(dict(BASE, fetch={"method": "ftp", "url": "x"}))
    with pytest.raises(OverlayError):
        parse_overlay({k: v for k, v in BASE.items() if k != "accuracy_note"})


def test_merge_polygons_drops_slivers():
    big = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]
    tiny = [[[20, 20], [20.1, 20], [20.1, 20.1], [20, 20.1], [20, 20]]]
    fc = {"features": [{"geometry": {"type": "Polygon", "coordinates": big}}, {"geometry": {"type": "Polygon", "coordinates": tiny}}]}
    g = merge_polygons(fc)
    assert g["type"] == "MultiPolygon" and len(g["coordinates"]) == 1
    assert geojson_bounds(g) == [0, 0, 10, 10]


def test_merge_polygons_empty_raises():
    with pytest.raises(OverlayError):
        merge_polygons({"features": []})


def test_repo_overlays_reference_known_sources():
    sources = load_manifests()
    for ov in load_overlays().values():
        require_sources([ov.source], sources)
        assert ov.accuracy_note


def test_rgb_band_args():
    from tmo_pipeline.overlays import rgb_band_args

    assert rgb_band_args([{"colorInterpretation": "Gray"}]) == ["-b", "1", "-b", "1", "-b", "1"]
    assert rgb_band_args([{"colorInterpretation": "Palette", "colorTable": {}}]) == ["-expand", "rgb"]
    assert rgb_band_args([{}, {}]) == ["-b", "1", "-b", "1", "-b", "1", "-b", "2"]
    assert rgb_band_args([{}, {}, {}]) is None
    with pytest.raises(OverlayError):
        rgb_band_args([{}] * 5)
