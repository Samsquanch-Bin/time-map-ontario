import pytest

from tmo_pipeline.research import TOPIC_CLASSES, parse_point, parse_sparql_rows, slugify, sparql_query, summarise_entity


def test_sparql_query_uses_focus_box_and_classes():
    q = sparql_query("battle", (-80.3, 42.8, -78.6, 44.5))
    assert 'Point(-80.3 42.8)' in q and 'Point(-78.6 44.5)' in q
    for cls in TOPIC_CLASSES["battle"]:
        assert f"wd:{cls}" in q
    with pytest.raises(ValueError):
        sparql_query("dragons")


def test_parse_point():
    assert parse_point("Point(-79.75 43.21)") == (-79.75, 43.21)
    with pytest.raises(ValueError):
        parse_point("LINESTRING(0 0, 1 1)")


def test_parse_sparql_rows():
    data = {"results": {"bindings": [{
        "item": {"value": "http://www.wikidata.org/entity/Q1"},
        "itemLabel": {"value": "Battle of Somewhere"},
        "coord": {"value": "Point(-79.7 43.2)"},
        "article": {"value": "https://en.wikipedia.org/wiki/Battle_of_Somewhere"},
    }]}}
    (row,) = parse_sparql_rows("battle", data)
    assert row["qid"] == "Q1" and row["lon"] == -79.7 and row["topic"] == "battle"


def test_summarise_entity_extracts_coords_and_dates():
    ent = {
        "labels": {"en": {"value": "X"}},
        "claims": {
            "P625": [{"mainsnak": {"snaktype": "value", "datavalue": {"value": {"longitude": -79.7, "latitude": 43.2, "precision": 0.0001}}}}],
            "P585": [{"mainsnak": {"snaktype": "value", "datavalue": {"value": {"time": "+1813-06-06T00:00:00Z"}}}}],
            "P571": [{"mainsnak": {"snaktype": "somevalue"}}],
        },
        "sitelinks": {"enwiki": {"title": "X"}},
    }
    s = summarise_entity(ent)
    assert s["coordinates"][0]["lat"] == 43.2
    assert s["dates"] == {"point_in_time": ["+1813-06-06T00:00:00Z"]}
    assert s["enwiki"] == "X"


def test_slugify():
    assert slugify("Battle of Stoney Creek!") == "battle-of-stoney-creek"
