import pytest

from tmo_pipeline.manifests import ManifestError, load_manifests, parse_manifest, require_sources

GOOD = {
    "id": "x",
    "name": "X",
    "provider": "P",
    "homepage": "https://example.org",
    "licence": "CC0",
    "attribution": "© X",
    "used_for": ["basemap"],
    "licence_check": {"status": "confirmed", "method": "read page", "checked_on": "2026-11-14"},
}


def test_parse_good():
    s = parse_manifest(GOOD)
    assert s.usable and s.used_for == ("basemap",)


@pytest.mark.parametrize("field", ["licence", "attribution", "licence_check", "homepage"])
def test_missing_required_field_rejected(field):
    bad = {k: v for k, v in GOOD.items() if k != field}
    with pytest.raises(ManifestError, match=field):
        parse_manifest(bad)


def test_bad_check_status():
    bad = dict(GOOD, licence_check={"status": "maybe", "method": "m", "checked_on": "d"})
    with pytest.raises(ManifestError):
        parse_manifest(bad)


def test_rejected_source_cannot_be_used():
    rej = parse_manifest(dict(GOOD, licence_check={"status": "rejected", "method": "m", "checked_on": "d"}))
    with pytest.raises(ManifestError, match="rejected"):
        require_sources(["x"], {"x": rej})


def test_unknown_source_cannot_be_used():
    with pytest.raises(ManifestError, match="no source manifest"):
        require_sources(["nope"], {})


def test_repo_manifests_all_valid():
    sources = load_manifests()
    assert {"openstreetmap", "protomaps_basemap", "esri_world_imagery"} <= set(sources)
    for s in sources.values():
        assert s.attribution.strip()
