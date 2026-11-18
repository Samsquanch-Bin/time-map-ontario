from tmo_pipeline.monuments import centroid, classify, props


def test_classify():
    assert classify({"historic": "battlefield", "name": "Battle of Stoney Creek"}) == "battlefield"
    assert classify({"historic": "monument"}) == "monument"
    assert classify({"historic": "memorial", "memorial": "cairn"}) == "monument"
    assert classify({"historic": "memorial", "memorial": "war_memorial"}) == "war_memorial"
    assert classify({"historic": "memorial", "memorial": "plaque"}) is None
    assert classify({"historic": "memorial", "memorial": "bench"}) is None
    assert classify({"historic": "memorial"}) is None


def test_props_and_centroid():
    p = props({"name": "Cairn", "inscription": "x" * 2000, "wikipedia": "en:Battle of Stoney Creek"}, "monument")
    assert len(p["inscription"]) == 1500 and p["wikipedia"].startswith("en:")
    assert centroid({"type": "Polygon", "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]}) == [1.0, 1.0]
