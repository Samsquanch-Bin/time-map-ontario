"""Basemap pack: a regional extract of the Protomaps OpenStreetMap build."""
from __future__ import annotations

import datetime as dt
import subprocess
from pathlib import Path

from .config import BUILD_DIR, SOUTH_BBOX

BUILD_URL = "https://build.protomaps.com/{date}.pmtiles"
# Public mirror used if the daily build bucket can't be reached.
FALLBACK_URL = "https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/protomaps/openstreetmap/v4.pmtiles"
BASEMAP_FILE = "basemap-south.pmtiles"
BASEMAP_MAXZOOM = 15


def candidate_build_urls(today: dt.date, days_back: int = 7) -> list[str]:
    """Daily build URLs to try, newest first (builds are kept for about a week)."""
    return [BUILD_URL.format(date=(today - dt.timedelta(days=d)).strftime("%Y%m%d")) for d in range(days_back + 1)]


def bbox_arg(bbox: tuple[float, float, float, float]) -> str:
    w, s, e, n = bbox
    if not (w < e and s < n):
        raise ValueError(f"invalid bbox {bbox}")
    return f"{w},{s},{e},{n}"


def find_build_url(today: dt.date | None = None) -> str:
    import requests

    for url in candidate_build_urls(today or dt.date.today()):
        try:
            r = requests.head(url, timeout=30, allow_redirects=True)
        except requests.RequestException:
            continue
        if r.status_code == 200:
            return url
    return FALLBACK_URL


def build_basemap(out_dir: Path = BUILD_DIR / "release", source_url: str | None = None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    url = source_url or find_build_url()
    out = out_dir / BASEMAP_FILE
    out.unlink(missing_ok=True)
    cmd = ["pmtiles", "extract", url, str(out), f"--bbox={bbox_arg(SOUTH_BBOX)}", f"--maxzoom={BASEMAP_MAXZOOM}"]
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)
    (out_dir.parent / "basemap-source.txt").write_text(url + "\n")
    return out
