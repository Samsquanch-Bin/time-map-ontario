import math

import pytest

from tmo_pipeline.places import PlaceError, build_places_json, circle_polygon, load_places, split_front_matter, to_app_record, validate_place, Place

BODY = " ".join(["word"] * 60)


def meta(**over):
    m = {
        "id": "battle-x",
        "title": "Battle X",
        "category": "battle",
        "date": {"start": 1813, "end": 1813, "label": "June 1813"},
        "location": {"lon": -79.76, "lat": 43.21, "precision": "exact", "basis": "Wikidata Q1 P625"},
        "sources": [{"title": "Battle X — Wikipedia", "url": "https://en.wikipedia.org/w/index.php?oldid=1", "retrieved": "2026-11-14"}],
        "researched_by": "Claude (unreviewed)",
    }
    m.update(over)
    return m


def test_valid_place_passes():
    validate_place(meta(), BODY)


@pytest.mark.parametrize(
    "over,msg",
    [
        ({"category": "dragons"}, "category"),
        ({"sources": []}, "source"),
        ({"sources": [{"title": "t", "url": "ftp://x", "retrieved": "d"}]}, "url"),
        ({"location": {"lon": -79.7, "lat": 43.2, "precision": "exact"}}, "basis"),
        ({"location": {"lon": -79.7, "lat": 43.2, "precision": "approximate", "basis": "b"}}, "radius_m"),
        ({"location": {"lon": 2.35, "lat": 48.85, "precision": "exact", "basis": "b"}}, "outside Ontario"),
        ({"category": "indigenous"}, "Nation"),
        ({"date": {"start": 1900, "end": 1800}}, "implausible"),
    ],
)
def test_invalid_places_rejected(over, msg):
    with pytest.raises(PlaceError, match=msg):
        validate_place(meta(**over), BODY)


def test_story_length_enforced():
    with pytest.raises(PlaceError, match="words"):
        validate_place(meta(), "too short")


def test_front_matter_split():
    m, body = split_front_matter("---\nid: a\n---\nHello there\n")
    assert m == {"id": "a"} and body == "Hello there"
    with pytest.raises(PlaceError):
        split_front_matter("no front matter")


def test_circle_polygon_radius():
    poly = circle_polygon(-79.5, 43.5, 1000)
    ring = poly["coordinates"][0]
    assert ring[0] == ring[-1]
    lon, lat = ring[0]
    dx = (lon + 79.5) * 111_320 * math.cos(math.radians(43.5))
    assert abs(dx - 1000) < 5


def test_area_places_get_polygons_and_exact_do_not():
    exact = to_app_record(Place(meta(), BODY))
    assert "area" not in exact and exact["in_focus_area"]
    approx = to_app_record(Place(meta(location={"lon": -79.5, "lat": 43.6, "precision": "approximate", "radius_m": 1500, "basis": "b"}), BODY))
    assert approx["area"]["type"] == "Polygon"


def test_release_rejects_samples():
    p = Place(meta(sample=True), BODY)
    build_places_json([p])
    with pytest.raises(PlaceError, match="sample"):
        build_places_json([p], release=True)


def test_repo_places_valid():
    load_places()  # every committed place file must validate
