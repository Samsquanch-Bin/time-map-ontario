"""Georeferencing scanned sheets from hand-picked control points (GCPs).

Each GCP ties an image pixel (x, y) to a modern street intersection (lon, lat).
We fit an affine transform (pixel -> web-mercator metres) by least squares and
report the residual of every point in ground metres, so a misread corner shows up
immediately and the accuracy note in the app is measured, not guessed.
"""
from __future__ import annotations

import math
from typing import Sequence

R = 6378137.0


def lonlat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    x = math.radians(lon) * R
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R
    return x, y


def _solve3(a: list[list[float]], b: list[float]) -> list[float]:
    """Solve a 3x3 linear system (Gaussian elimination with pivoting)."""
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(3):
        p = max(range(c, 3), key=lambda r: abs(m[r][c]))
        if abs(m[p][c]) < 1e-12:
            raise ValueError("control points are degenerate (collinear?)")
        m[c], m[p] = m[p], m[c]
        for r in range(3):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [v - f * w for v, w in zip(m[r], m[c])]
    return [m[i][3] / m[i][i] for i in range(3)]


def fit_affine(gcps: Sequence[Sequence[float]]) -> tuple[list[float], list[float]]:
    """Least-squares affine from [(px, py, lon, lat), ...] to mercator metres.
    Returns (coeffs_x, coeffs_y) where X = a*px + b*py + c."""
    if len(gcps) < 3:
        raise ValueError("need at least 3 control points")
    rows = [(g[0], g[1], 1.0) for g in gcps]
    merc = [lonlat_to_mercator(g[2], g[3]) for g in gcps]
    ata = [[sum(r[i] * r[j] for r in rows) for j in range(3)] for i in range(3)]
    cx = _solve3(ata, [sum(r[i] * m[0] for r, m in zip(rows, merc)) for i in range(3)])
    cy = _solve3(ata, [sum(r[i] * m[1] for r, m in zip(rows, merc)) for i in range(3)])
    return cx, cy


def residuals_m(gcps: Sequence[Sequence[float]]) -> list[float]:
    """Ground distance (metres) between each GCP and where the fitted transform puts it."""
    cx, cy = fit_affine(gcps)
    out = []
    for g in gcps:
        X = cx[0] * g[0] + cx[1] * g[1] + cx[2]
        Y = cy[0] * g[0] + cy[1] * g[1] + cy[2]
        mx, my = lonlat_to_mercator(g[2], g[3])
        out.append(math.hypot(X - mx, Y - my) * math.cos(math.radians(g[3])))
    return out


def rmse(values: Sequence[float]) -> float:
    return math.sqrt(sum(v * v for v in values) / len(values)) if values else float("nan")


def ground_scale(gcps: Sequence[Sequence[float]]) -> float:
    """Metres on the ground per image pixel (sanity check against the map's stated scale)."""
    cx, cy = fit_affine(gcps)
    lat = sum(g[3] for g in gcps) / len(gcps)
    return math.hypot(cx[0], cy[0]) * math.cos(math.radians(lat))
