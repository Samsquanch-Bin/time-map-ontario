import math

import pytest

from tmo_pipeline.georef import fit_affine, ground_scale, lonlat_to_mercator, residuals_m, rmse


def _synthetic(err=None):
    # a sheet at 0.5 m/pixel, rotated 10°, anchored in downtown Hamilton
    lon0, lat0 = -79.87, 43.256
    x0, y0 = lonlat_to_mercator(lon0, lat0)
    k = 0.5 / math.cos(math.radians(lat0))  # mercator metres per pixel
    th = math.radians(10)
    pts = []
    for px, py in [(100, 100), (3000, 200), (2800, 2500), (300, 2400), (1500, 1300)]:
        X = x0 + k * (px * math.cos(th) - py * math.sin(th))
        Y = y0 - k * (px * math.sin(th) + py * math.cos(th))
        lon = math.degrees(X / 6378137.0)
        lat = math.degrees(2 * math.atan(math.exp(Y / 6378137.0)) - math.pi / 2)
        pts.append([px, py, lon, lat])
    if err:
        pts[err[0]][0] += err[1]
    return pts


def test_perfect_fit_has_zero_residuals_and_right_scale():
    g = _synthetic()
    assert rmse(residuals_m(g)) < 0.01
    assert abs(ground_scale(g) - 0.5) < 0.001


def test_misread_point_shows_up_in_residuals():
    g = _synthetic(err=(4, 60))  # one corner misread by 60 px = 30 m
    res = residuals_m(g)
    assert max(res) == res[4] and res[4] > 15


def test_needs_three_points():
    with pytest.raises(ValueError):
        fit_affine(_synthetic()[:2])


def test_affine_geotransform_maps_pixels_like_the_fit():
    from tmo_pipeline.overlays import affine_geotransform

    g = _synthetic()
    cx, cy = fit_affine(g)
    x0, y0 = 50, 80
    gt = affine_geotransform(cx, cy, x0, y0)
    for px, py, lon, lat in g:
        X = gt[0] + (px - x0) * gt[1] + (py - y0) * gt[2]
        Y = gt[3] + (px - x0) * gt[4] + (py - y0) * gt[5]
        mx, my = lonlat_to_mercator(lon, lat)
        assert abs(X - mx) < 0.05 and abs(Y - my) < 0.05


def test_set_vrt_geotransform(tmp_path):
    from tmo_pipeline.overlays import set_vrt_geotransform

    v = tmp_path / "a.vrt"
    v.write_text('<VRTDataset rasterXSize="10" rasterYSize="10">\n  <SRS>EPSG:3857</SRS>\n  <GeoTransform>0,1,0,0,0,-1</GeoTransform>\n</VRTDataset>')
    set_vrt_geotransform(v, [1, 2, 3, 4, 5, 6])
    t = v.read_text()
    assert t.count("<GeoTransform>") == 1 and "1.0000000000, 2.0000000000" in t
