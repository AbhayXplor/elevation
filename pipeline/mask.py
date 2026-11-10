"""Rasterise Overture water polygons onto the terrain grid to separate true
land from the Gulf, the Creek and the marinas.

Copernicus encodes sea as exactly 0 m, but so do a number of low sabkha and
reclamation surfaces inland. Rasterising water polygons removes that ambiguity,
which matters because the map must never paint risk over open water.
"""
from __future__ import annotations

import json
from pathlib import Path

import duckdb
import numpy as np
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import transform_geom

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ORIGIN_SHIFT = 20037508.342789244


def main() -> None:
    meta = json.loads((DATA / "terrain.meta.json").read_text())
    x0, y0, z = meta["x0"], meta["y0"], meta["z"]
    H, W = meta["height_px"], meta["width_px"]
    pix = ORIGIN_SHIFT * 2.0 / (2 ** z * 256)
    transform = from_origin(-ORIGIN_SHIFT + x0 * 256 * pix, ORIGIN_SHIFT - y0 * 256 * pix, pix, pix)

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial; SET geometry_always_xy = true;")
    rows = con.execute(
        f"SELECT ST_AsWKB(geometry), class FROM '{(DATA / 'water.parquet').as_posix()}'"
    ).fetchall()
    print(f"{len(rows)} water polygons")

    from shapely import wkb as shapely_wkb

    shapes = []
    for w, cls in rows:
        try:
            g = shapely_wkb.loads(w)
        except Exception:  # noqa: BLE001
            continue
        g = transform_geom("EPSG:4326", "EPSG:3857", g.__geo_interface__)
        shapes.append((g, 1))

    water = rasterize(
        shapes,
        out_shape=(H, W),
        transform=transform,
        fill=0,
        dtype=np.uint8,
        all_touched=False,
    ).astype(bool)

    land = ~water
    np.save(DATA / "land.npy", land)
    print(f"water fraction {water.mean():.3f}  land fraction {land.mean():.3f}")

    # Also export a small GeoJSON of major water bodies for the map's own use.
    (DATA / "mask.meta.json").write_text(
        json.dumps({"water_fraction": round(float(water.mean()), 4), "classes": len(rows)})
    )


if __name__ == "__main__":
    main()
