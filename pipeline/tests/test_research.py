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


def test_service_urls_and_mercator():
    from tmo_pipeline.map_discovery import mercator_to_lonlat, service_urls

    d = {"folders": ["EarlyNiagara"], "services": [{"name": "EarlyNiagara/Map1826", "type": "ImageServer"}, {"name": "X", "type": "GPServer"}]}
    folders, services = service_urls(d, "https://h/arcgis/rest/services/EarlyNiagara")
    assert folders == ["https://h/arcgis/rest/services/EarlyNiagara"]
    assert services == ["https://h/arcgis/rest/services/EarlyNiagara/Map1826/ImageServer"]
    lon, lat = mercator_to_lonlat(-8_870_000, 5_350_000)
    assert -80 < lon < -79.5 and 43 < lat < 44


def test_service_urls_tolerates_odd_directories():
    from tmo_pipeline.map_discovery import service_urls

    assert service_urls([], "https://h/arcgis/rest/services") == ([], [])
    d = {"folders": None, "services": [{"name": "Toronto1858", "type": "MapServer", "url": "https://t/Toronto1858/MapServer"}]}
    assert service_urls(d, "https://t/arcgis/rest/services") == ([], ["https://t/Toronto1858/MapServer"])


def test_tile_summary():
    from tmo_pipeline.map_discovery import tile_summary

    assert tile_summary({}) == {"tiled": False}
    info = {"tileInfo": {"rows": 256, "spatialReference": {"wkid": 102100, "latestWkid": 3857}, "lods": [{"level": 0}, {"level": 19}]}, "minLOD": 13, "maxLOD": 19, "copyrightText": "TPL"}
    assert tile_summary(info) == {"tiled": True, "tile_wkid": 3857, "tile_size": 256, "min_lod": 13, "max_lod": 19, "copyright": "TPL"}


def test_extract_links_resolves_and_finds_images():
    from tmo_pipeline.webfetch import extract_links

    html = '<a href="/maps/sheet-1">Sheet 1</a><img src="files/s1.jpg"><a href="/maps/sheet-1">dup</a>'
    links = extract_links(html, "https://lib.example/maps/index")
    urls = [l["url"] for l in links]
    assert "https://lib.example/maps/sheet-1" in urls and "https://lib.example/maps/files/s1.jpg" in urls
    assert len(urls) == 2
