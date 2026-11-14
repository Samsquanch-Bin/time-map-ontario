import pytest

from tmo_pipeline.nts import sheet_bounds, sheets_polygon
from tmo_pipeline.overlays import OverlayError, definition_hash, load_overlays, parse_overlay


def test_named_sheets_contain_their_towns():
    # (sheet, a point in the town the sheet is named after)
    for sheet, (lon, lat) in {
        "030M05C": (-79.80, 43.33),  # Burlington
        "030M05D": (-79.95, 43.27),  # Dundas
        "030M12A": (-79.58, 43.55),  # Port Credit
        "030M12B": (-79.71, 43.59),  # Streetsville
        "030M12G": (-79.65, 43.71),  # Malton
        "030M12H": (-79.52, 43.70),  # Weston
        "030M11E": (-79.45, 43.66),  # West Toronto
        "030M05": (-79.87, 43.26),  # Hamilton
        "030M11": (-79.38, 43.65),  # Toronto
        "030M12": (-79.76, 43.68),  # Brampton
    }.items():
        w, s, e, n = sheet_bounds(sheet)
        assert w <= lon <= e and s <= lat <= n, sheet


def test_sheet_sizes():
    assert sheet_bounds("030M") == (-80.0, 43.0, -78.0, 44.0)
    assert sheet_bounds("030M05") == (-80.0, 43.25, -79.5, 43.5)
    assert sheet_bounds("030M05C") == (-79.875, 43.25, -79.75, 43.375)


def test_combined_printing_polygon():
    poly = sheets_polygon(["030M05G", "030M05B", "030M05H"])
    assert len(poly["coordinates"]) == 3


def test_bad_sheet():
    with pytest.raises(ValueError):
        sheet_bounds("Q30M05")


def _topo(**over):
    d = {"id": "t", "title": "T", "year": 1963, "source": "s", "accuracy_note": "a", "maxzoom": 16,
         "fetch": {"method": "geotiff_sheets", "sheets": [{"url": "https://x/y.tif", "nts": ["030M05C"]}]}}
    d.update(over)
    return d


def test_geotiff_sheets_parse_and_reject():
    assert parse_overlay(_topo()).fetch["method"] == "geotiff_sheets"
    with pytest.raises(OverlayError):
        parse_overlay(_topo(maxzoom=None))
    with pytest.raises(OverlayError):
        parse_overlay(_topo(fetch={"method": "geotiff_sheets", "sheets": [{"url": "https://x", "nts": ["nope"]}]}))


def test_definition_hash_changes_with_definition():
    a = parse_overlay(_topo())
    b = parse_overlay(_topo(title="Other"))
    assert definition_hash(a) == definition_hash(parse_overlay(_topo()))
    assert definition_hash(a) != definition_hash(b)


def test_every_topo_overlay_sheet_is_a_valid_nts_sheet():
    for ov in load_overlays().values():
        if ov.fetch["method"] == "geotiff_sheets":
            for sh in ov.fetch["sheets"]:
                for n in sh["nts"]:
                    sheet_bounds(n)
