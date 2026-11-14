"""Shared constants for the pipeline."""
from __future__ import annotations

from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = PIPELINE_DIR.parent
SOURCES_DIR = PIPELINE_DIR / "sources"
OVERLAYS_DIR = PIPELINE_DIR / "overlays"
SCHEMAS_DIR = REPO_DIR / "schemas"
BUILD_DIR = PIPELINE_DIR / "build"
CACHE_DIR = PIPELINE_DIR / "cache"

GITHUB_REPO = "Samsquanch-Bin/time-map-ontario"
DATA_RELEASE_TAG = "data-latest"
DATA_RELEASE_BASE_URL = f"https://github.com/{GITHUB_REPO}/releases/download/{DATA_RELEASE_TAG}"

# [west, south, east, north] in WGS84 degrees.
# Focus area: Toronto (GTA), Hamilton and Niagara. Gets full detail.
FOCUS_BBOX = (-80.30, 42.80, -78.60, 44.50)
# Southern Ontario: offline basemap coverage (measured ~1.2 GB at z15 for this box,
# under GitHub's 2 GB per-release-asset limit).
SOUTH_BBOX = (-83.60, 41.60, -74.30, 46.60)

# GitHub release assets must be < 2 GiB each.
MAX_RELEASE_ASSET_BYTES = 2 * 1024**3 - 1
