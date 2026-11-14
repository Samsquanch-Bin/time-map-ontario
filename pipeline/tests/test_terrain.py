from tmo_pipeline.config import FOCUS_BBOX
from tmo_pipeline.terrain import tile_range, tiles_for


def test_tile_range_hamilton():
    # Hamilton (-79.87, 43.26) is tile 1139/1501 at zoom 12
    x0, y0, x1, y1 = tile_range((-79.87, 43.26, -79.87, 43.26), 12)
    assert (x0, y0) == (x1, y1) == (1139, 1501)


def test_focus_area_tile_count_is_modest():
    tiles = tiles_for(FOCUS_BBOX, 12)
    assert 700 < len(tiles) < 900
    assert tiles[0] == (0, 0, 0)
