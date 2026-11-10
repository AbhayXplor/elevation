"""Extract building centroids/attributes and derive a built-up density raster."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import duckdb
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def main() -> None:
    meta = json.loads((DATA / "terrain.meta.json").read_text())
    x0, y0, z = meta["x0"], meta["y0"], meta["z"]
    H, W = meta["height_px"], meta["width_px"]

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial; SET geometry_always_xy = true;")

    # Centroid + area in metres + available attributes.
    con.execute(
        f"""
        CREATE TABLE b AS
        SELECT
            id,
            ST_X(ST_Centroid(geometry)) AS lon,
            ST_Y(ST_Centroid(geometry)) AS lat,
            ST_Area(ST_Transform(geometry, 'EPSG:4326', 'EPSG:32640')) AS area_m2,
            height,
            num_floors,
            subtype,
            class
        FROM '{(DATA / "buildings.parquet").as_posix()}'
        WHERE ST_Area(ST_Transform(geometry, 'EPSG:4326', 'EPSG:32640')) > 25
        """
    )
    n = con.execute("SELECT count(*) FROM b").fetchone()[0]
    print(f"{n} buildings with area > 25 m2")

    # Density raster at 1/4 terrain resolution (~69 m cells), blurred to ~350 m.
    step = 4
    gh, gw = H // step, W // step
    n_ = 2 ** z
    px = ((con.execute("SELECT lon FROM b").fetchnumpy()["lon"].astype("float64") + 180.0) / 360.0 * n_ * 256.0) - x0 * 256.0
    lat = con.execute("SELECT lat FROM b").fetchnumpy()["lat"].astype("float64")
    lat_r = np.radians(lat)
    py = ((1.0 - np.log(np.tan(lat_r) + 1.0 / np.cos(lat_r)) / np.pi) / 2.0 * n_ * 256.0) - y0 * 256.0

    ix = np.clip((px / step).astype(np.int32), 0, gw - 1)
    iy = np.clip((py / step).astype(np.int32), 0, gh - 1)
    counts = np.zeros((gh, gw), dtype=np.float32)
    np.add.at(counts, (iy, ix), 1.0)

    dens = ndi.gaussian_filter(counts, sigma=5.0)
    hi = np.percentile(dens, 97.5)
    dens = np.clip(dens / max(hi, 1e-6), 0, 1).astype(np.float32)
    np.save(DATA / "density.npy", dens)
    print(f"density raster {gw}x{gh}  max={dens.max():.2f}  cells_with_buildings={(counts>0).sum()}")

    con.execute(f"COPY b TO '{(DATA / 'building_centroids.parquet').as_posix()}' (FORMAT PARQUET)")


if __name__ == "__main__":
    main()
