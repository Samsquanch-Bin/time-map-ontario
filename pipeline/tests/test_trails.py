from tmo_pipeline.trails import classify, parse_other_tags


def test_bruce_trail_routes():
    assert classify({"route": "hiking", "name": "Bruce Trail"}, True) == "bruce"
    assert classify({"route": "hiking", "name": "Iroquoia Section", "operator": "Bruce Trail Conservancy"}, True) == "bruce"
    assert classify({"route": "hiking", "name": "Rattlesnake Point Side Trail", "operator": "Bruce Trail Conservancy"}, True) == "side"
    assert classify({"route": "foot", "name": "Trans Canada Trail"}, True) == "route"


def test_ways():
    assert classify({"highway": "path", "name": "Bruce Trail"}, False) == "bruce"
    assert classify({"highway": "cycleway", "name": "Hamilton-Brantford Rail Trail"}, False) == "path"
    assert classify({"highway": "path"}, False) == "minor"
    assert classify({"highway": "footway", "footway": "sidewalk", "name": "Main St"}, False) is None
    assert classify({"highway": "footway"}, False) is None
    assert classify({"highway": "track"}, False) is None
    assert classify({"highway": "path", "access": "private"}, False) is None
    assert classify({"highway": "residential", "name": "Bruce St"}, False) is None
    assert classify({"route": "bicycle", "name": "Waterfront Trail"}, True) is None


def test_other_tags():
    assert parse_other_tags('"surface"=>"gravel","operator"=>"Bruce Trail Conservancy"') == {"surface": "gravel", "operator": "Bruce Trail Conservancy"}
    assert parse_other_tags(None) == {}


def test_indoor_walkways_left_out():
    assert classify({"highway": "footway", "name": "Cumberland Terrace Ground Floor"}, False) is None
    assert classify({"highway": "footway", "indoor": "yes", "name": "PATH"}, False) is None
    assert classify({"route": "foot", "name": "Yonge-Bloor underground path system"}, True) is None
    assert classify({"highway": "path", "name": "Rosedale Valley Trail"}, False) == "path"
