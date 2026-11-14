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


def test_terrarium_converts_to_terrain_rgb():
    import io

    import numpy as np
    from PIL import Image

    from tmo_pipeline.terrain import terrarium_to_terrain_rgb

    heights = np.array([[0.0, 74.5], [325.25, -12.0]])  # lake level, escarpment, a pit
    v = heights + 32768
    r = np.floor(v / 256)
    g = np.floor(v - r * 256)
    b = np.round((v - np.floor(v)) * 256)
    img = Image.fromarray(np.stack([r, g, b], -1).astype(np.uint8), "RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    out = np.asarray(Image.open(io.BytesIO(terrarium_to_terrain_rgb(buf.getvalue()))), dtype=np.float64)
    decoded = -10000 + (out[..., 0] * 65536 + out[..., 1] * 256 + out[..., 2]) * 0.1
    assert np.allclose(decoded, heights, atol=0.06)
