"""Check that the app's plaque request works against the Ontario Heritage Trust's service.

Prints counts only. The Trust's terms don't allow redistribution, so no plaque content
is saved or committed anywhere; the app fetches the plaques itself, onto the phone.
"""
from __future__ import annotations

import requests

SERVICE = "https://services5.arcgis.com/wMPKKIM77NIigfTk/arcgis/rest/services/Ontario_Provincial_Plaques_View/FeatureServer/0"
FIELDS = ("OBJECTID_1,Unique_Name,Plaque_text,Location,Street_address,Postal_Code,Municipality_Lower_Single,"
          "Municipality_Upper_District,Province,Country,Themes,Fr_Title,Fr_PlaqueText,Fr_Location,SVI_URL,Web_URL")


def run() -> None:
    total, with_geom, filled, offset, pages = 0, 0, {}, 0, 0
    lons, lats = [], []
    while pages < 20:
        r = requests.get(f"{SERVICE}/query", params={
            "where": "1=1", "outFields": FIELDS, "returnGeometry": "true", "outSR": "4326",
            "orderByFields": "OBJECTID_1", "resultOffset": offset, "resultRecordCount": 1000, "f": "json"}, timeout=120)
        d = r.json()
        if "error" in d:
            raise SystemExit(f"service error: {d['error']}")
        feats = d.get("features", [])
        pages += 1
        total += len(feats)
        for f in feats:
            g = f.get("geometry") or {}
            if isinstance(g.get("x"), (int, float)) and isinstance(g.get("y"), (int, float)):
                with_geom += 1
                lons.append(g["x"]); lats.append(g["y"])
            for k, v in (f.get("attributes") or {}).items():
                if v not in (None, ""):
                    filled[k] = filled.get(k, 0) + 1
        if not d.get("exceededTransferLimit"):
            break
        offset += 1000
    print(f"pages {pages}, plaques {total}, with a position {with_geom}")
    if lons:
        print(f"lon range {min(lons):.3f}..{max(lons):.3f}, lat range {min(lats):.3f}..{max(lats):.3f}")
        inside = sum(1 for x, y in zip(lons, lats) if -95.2 <= x <= -74.3 and 41.6 <= y <= 56.9)
        print(f"inside Ontario's bounding box: {inside}")
    for k in FIELDS.split(","):
        print(f"  {k}: filled in {filled.get(k, 0)}")
