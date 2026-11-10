"""
Build the terrain substrate for the Elevation pluvial screen.

Source: Copernicus DEM GLO-30 (`copernicus-dem-30m` on AWS Open Data), anonymous,
no key, 30 m global coverage. Chosen over the Mapzen terrarium tiles after
terrarium was found to return permanent void tiles over northern Dubai.

The source GeoTIFFs are reprojected onto the Web Mercator pixel grid at z=13 so
downstream code can address terrain by map pixel as well as by coordinate.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import requests
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DEMDIR = DATA / "dem"

BBOX = (55.02, 24.92, 55.52, 25.40)  # minLon, minLat, maxLon, maxLat
Z = 13
TILES = ["N24_00_E055_00", "N25_00_E055_00"]

R_EARTH = 6378137.0
ORIGIN_SHIFT = math.pi * R_EARTH  # 20037508.342789244
UA = {"User-Agent": "elevation/0.1 (hackathon research)"}


def lonlat_to_px(lon, lat, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n * 256.0
    lat_r = math.radians(lat)
    y = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n * 256.0
    return x, y


def download(tile: str) -> Path:
    DEMDIR.mkdir(parents=True, exist_ok=True)
    out = DEMDIR / f"{tile}.tif"
    if out.exists() and out.stat().st_size > 1_000_000:
        print(f"  cached {out.name}")
        return out
    url = (
        "https://copernicus-dem-30m.s3.amazonaws.com/"
        f"Copernicus_DSM_COG_10_{tile}_DEM/Copernicus_DSM_COG_10_{tile}_DEM.tif"
    )
    print(f"  downloading {tile} ...")
    with requests.get(url, headers=UA, stream=True, timeout=180) as r:
        r.raise_for_status()
        with open(out, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    print(f"  {out.name} {out.stat().st_size/1e6:.1f} MB")
    return out


def main() -> None:
    tx0, ty0 = (v / 256.0 for v in lonlat_to_px(BBOX[0], BBOX[3], Z))
    tx1, ty1 = (v / 256.0 for v in lonlat_to_px(BBOX[2], BBOX[1], Z))
    x0, y0 = int(math.floor(tx0)), int(math.floor(ty0))
    x1, y1 = int(math.floor(tx1)), int(math.floor(ty1))
    nx, ny = x1 - x0 + 1, y1 - y0 + 1
    W, H = nx * 256, ny * 256

    pix = (2.0 * ORIGIN_SHIFT) / (2 ** Z * 256)
    transform = from_origin(
        -ORIGIN_SHIFT + x0 * 256 * pix,
        ORIGIN_SHIFT - y0 * 256 * pix,
        pix,
        pix,
    )

    mosaic = np.full((H, W), np.nan, dtype=np.float32)
    for tile in TILES:
        path = download(tile)
        with rasterio.open(path) as src:
            from rasterio.windows import from_bounds

            b = src.bounds
            # Source tile bounds in lon/lat; intersect with our bbox.
            win = from_bounds(
                max(b.left, BBOX[0]),
                max(b.bottom, BBOX[1]),
                min(b.right, BBOX[2]),
                min(b.top, BBOX[3]),
                transform=src.transform,
            )
            arr = src.read(1, window=win).astype(np.float32)
            arr[arr < -1000] = np.nan  # Copernicus void sentinel
            arr[arr == 0] = 0.0  # sea kept at 0
            reproject(
                source=arr,
                destination=mosaic,
                src_transform=src.window_transform(win),
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs="EPSG:3857",
                resampling=Resampling.bilinear,
                src_nodata=np.nan,
                dst_nodata=np.nan,
                init_dest_nodata=False,
            )
            print(f"  reprojected {tile}: {arr.shape}")

    valid = np.isfinite(mosaic)
    mosaic = np.where(valid, mosaic, 0.0).astype(np.float32)

    np.savez_compressed(
        DATA / "terrain.npz",
        elev=mosaic,
        x0=x0,
        y0=y0,
        z=Z,
        nx=nx,
        ny=ny,
        bbox=np.array(BBOX),
    )
    meta = {
        "source": "Copernicus DEM GLO-30 (AWS Open Data, copernicus-dem-30m)",
        "z": Z,
        "x0": x0,
        "y0": y0,
        "nx": nx,
        "ny": ny,
        "width_px": W,
        "height_px": H,
        "bbox": list(BBOX),
        "meters_per_px": round(pix * math.cos(math.radians(25.16)), 3),
        "elev_min": float(mosaic.min()),
        "elev_max": float(mosaic.max()),
        "elev_p50": float(np.median(mosaic)),
        "nodata_fraction": round(float(1 - valid.mean()), 4),
    }
    (DATA / "terrain.meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
