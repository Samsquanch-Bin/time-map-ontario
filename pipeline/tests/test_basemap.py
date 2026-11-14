import datetime as dt

import pytest

from tmo_pipeline.basemap import bbox_arg, candidate_build_urls
from tmo_pipeline.config import FOCUS_BBOX, SOUTH_BBOX


def test_candidate_urls_newest_first():
    urls = candidate_build_urls(dt.date(2026, 11, 14), days_back=2)
    assert urls == [
        "https://build.protomaps.com/20261114.pmtiles",
        "https://build.protomaps.com/20261113.pmtiles",
        "https://build.protomaps.com/20261112.pmtiles",
    ]


def test_bbox_arg():
    assert bbox_arg((-1, -2, 3, 4)) == "-1,-2,3,4"
    with pytest.raises(ValueError):
        bbox_arg((3, 0, 1, 1))


def test_focus_area_inside_basemap():
    fw, fs, fe, fn = FOCUS_BBOX
    w, s, e, n = SOUTH_BBOX
    assert w <= fw and s <= fs and fe <= e and fn <= n
