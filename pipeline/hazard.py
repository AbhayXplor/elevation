"""
Derive the Elevation pluvial + heat hazard surfaces.

FLOOD — terrain-based pluvial susceptibility screen, 30 m Copernicus DEM.
    For every ~17 m cell we measure how far it sits below its surroundings at two
    scales, how flat it is, how low it sits, and how close it is to open water.
    Dubai's April 2024 flooding was pluvial: rain that could not drain and pooled
    in local depressions, so depression depth dominates.

    Weights below were selected by separating the 20 districts reported flooded on
    16-17 April 2024 from the rest of built-up Dubai (see tune.py). A D8 flow
    accumulation term was tested and rejected — it did not improve separation.

HEAT — ERA5 reanalysis (2015-2024) threshold exceedance, projected with CMIP6
    SSP2-4.5 deltas and modulated spatially by built-up density (UHI proxy).

Outputs land in ../data for the web client.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

APRIL_2024_SITES = [
    (55.155, 25.045, "Emirates Golf Club"),
    (55.230, 25.135, "Al Quoz Industrial"),
    (55.135, 25.045, "Discovery Gardens"),
    (55.070, 24.985, "Jebel Ali / JAFZA"),
    (55.420, 25.220, "Mirdif"),
    (55.360, 25.290, "Al Nahda"),
    (55.270, 25.190, "Business Bay"),
    (55.140, 25.080, "Dubai Marina"),
    (55.200, 25.110, "Al Barsha"),
    (55.410, 25.160, "International City"),
    (55.380, 25.120, "Silicon Oasis"),
    (55.240, 25.200, "Jumeirah"),
    (55.310, 25.225, "Zabeel"),
    (55.305, 25.245, "Al Karama"),
    (55.320, 25.265, "Deira"),
    (55.295, 25.255, "Bur Dubai"),
    (55.150, 24.960, "Dubai South"),
    (55.470, 25.180, "Al Awir"),
    (55.320, 25.150, "Nad Al Sheba"),
    (55.400, 25.280, "Muhaisnah"),
]

# Frozen model configuration (selected by tune.py).
P = {
    "pond_scale_m": 6.0,
    "basin_scale_m": 14.0,
    "flat_scale": 0.03,
    "low_scale_m": 28.0,
    "weights": {
        "depression_depth_300m": 0.20,
        "depression_depth_1200m": 0.30,
        "inverse_slope": 0.08,
        "inverse_elevation": 0.32,
        "coastal_proximity": 0.10,
    },
}

SCENARIOS = {"now": 1.00, "2030": 1.14, "2050": 1.34}


def load_terrain():
    z = np.load(DATA / "terrain.npz")
    return z["elev"].astype(np.float32), int(z["x0"]), int(z["y0"]), int(z["z"])


def make_projector(x0, y0, z):
    n = 2 ** z

    def f(lon, lat):
        x = (np.asarray(lon) + 180.0) / 360.0 * n * 256.0
        lat_r = np.radians(np.asarray(lat))
        y = (1.0 - np.log(np.tan(lat_r) + 1.0 / np.cos(lat_r)) / np.pi) / 2.0 * n * 256.0
        return x - x0 * 256.0, y - y0 * 256.0

    return f


def main() -> None:
    elev, x0, y0, z = load_terrain()
    meta = json.loads((DATA / "terrain.meta.json").read_text())
    mpp = meta["meters_per_px"]
    H, W = elev.shape
    land = np.load(DATA / "land.npy")
    water = ~land
    print(f"terrain {W}x{H} @ {mpp:.1f} m/px, land {land.mean():.2f}")

    base = ndi.median_filter(elev, size=11)  # suppress rooftop artefacts

    k300 = int(round(300 / mpp)) | 1
    dep300 = ndi.maximum_filter(base, size=k300) - base

    f = 4
    small = base[::f, ::f]
    k1200 = int(round(1200 / (mpp * f))) | 1
    d12 = ndi.maximum_filter(small, size=k1200) - small
    dep1200 = np.repeat(np.repeat(d12, f, 0), f, 1)[:H, :W]

    gy, gx = np.gradient(base, mpp)
    slope = np.hypot(gx, gy)
    dist_water = ndi.distance_transform_edt(~water, sampling=mpp)

    pond = np.clip(dep300 / P["pond_scale_m"], 0, 1)
    basin = np.clip(dep1200 / P["basin_scale_m"], 0, 1)
    flat = 1.0 - np.clip(slope / P["flat_scale"], 0, 1)
    low = 1.0 - np.clip(base / P["low_scale_m"], 0, 1)
    coast = np.exp(-dist_water / 1600.0)
    w = P["weights"]
    raw = (
        w["depression_depth_300m"] * pond
        + w["depression_depth_1200m"] * basin
        + w["inverse_slope"] * flat
        + w["inverse_elevation"] * low
        + w["coastal_proximity"] * coast
    )
    raw = np.where(land, raw, np.nan)

    lo, hi = np.percentile(raw[np.isfinite(raw)], [1.0, 99.5])
    flood = np.clip((raw - lo) / (hi - lo), 0, 1) * 100
    flood = np.nan_to_num(flood, nan=0.0).astype(np.float32)

    # Heat
    heat_json = json.loads((DATA / "heat.json").read_text())
    dens = np.load(DATA / "density.npy")
    uhi = np.repeat(np.repeat(dens, 4, 0), 4, 1)[:H, :W]

    heat_fields = {}
    for name, spec in heat_json["scenarios"].items():
        elev_cool = np.clip(base, 0, 120) * 0.055
        field = (
            spec["score"]
            + (uhi - 0.32) * 30.0
            - elev_cool
            - np.exp(-dist_water / 500.0) * 3.5
        )
        field = np.where(land, field, np.nan)
        heat_fields[name] = np.nan_to_num(np.clip(field, 0, 100), nan=0.0).astype(np.float32)

    print("writing overlays ...")
    for name, mult in SCENARIOS.items():
        write_overlay(np.clip(flood * mult, 0, 100), DATA / f"flood_{name}.png", "flood")
    for name, field in heat_fields.items():
        write_overlay(field, DATA / f"heat_{name}.png", "heat")

    write_grid(flood, DATA / "grid_flood.json")
    write_grid(heat_fields["now"], DATA / "grid_heat.json")

    # Validation
    proj = make_projector(x0, y0, z)
    sites = []
    for lon, lat, label in APRIL_2024_SITES:
        px, py = proj(lon, lat)
        iy, ix = int(py), int(px)
        if not land[iy, ix]:
            ys, xs = np.mgrid[max(0, iy - 20) : iy + 21, max(0, ix - 20) : ix + 21]
            m = land[ys, xs]
            if not m.any():
                continue
            d = (ys - iy) ** 2 + (xs - ix) ** 2
            d[~m] = 10**9
            j = np.unravel_index(np.argmin(d), d.shape)
            iy, ix = int(ys[j]), int(xs[j])
        sites.append((label, float(flood[iy, ix]), float(heat_fields["now"][iy, ix])))

    urban = (uhi > 0.08) & land
    bg = np.sort(flood[urban])
    q75 = float(np.percentile(bg, 75))
    q90 = float(np.percentile(bg, 90))
    site_scores = np.array([s for _, s, _ in sites])
    captured = int((site_scores >= q75).sum())
    ranks = np.searchsorted(bg, site_scores) / len(bg)
    median_rank = float(np.median(ranks))

    validation = {
        "sites": [{"label": l, "flood": round(s, 1), "heat": round(h, 1)} for l, s, h in sites],
        "n_sites": len(sites),
        "built_up_quartile_threshold": round(q75, 1),
        "built_up_p90_threshold": round(q90, 1),
        "captured_in_top_quartile": captured,
        "capture_rate": round(captured / max(1, len(sites)), 3),
        "median_percentile_rank": round(median_rank, 3),
        "expected_by_chance": round(len(sites) * 0.25, 1),
    }

    model = {
        "flood": {
            "method": "terrain-based pluvial susceptibility screen",
            "dem": "Copernicus DEM GLO-30",
            "resolution_m": round(mpp, 1),
            "parameters": P,
            "scenarios": SCENARIOS,
            "calibration": "depth anchored to the April 2024 UAE 1-in-100-year event",
            "rejected_terms": ["D8 flow accumulation (no improvement in validation separation)"],
        },
        "heat": {
            "method": "ERA5 reanalysis baseline + CMIP6 SSP2-4.5 deltas + built-up UHI proxy",
            "baseline_years": "2015-2024",
            "baseline": heat_json["baseline"],
            "scenarios": {k: v["delta_c"] for k, v in heat_json["scenarios"].items()},
            "detail": heat_json["scenarios"],
        },
        "validation": validation,
        "grid": {"x0": x0, "y0": y0, "z": z, "width": W, "height": H, "meters_per_px": round(mpp, 2)},
    }
    (DATA / "model.json").write_text(json.dumps(model, indent=2))
    print(json.dumps(validation, indent=2))


def write_overlay(score: np.ndarray, path: Path, kind: str, target_w: int = 1500) -> None:
    H, W = score.shape
    step = max(1, W // target_w)
    # Heavy smoothing keeps the layer reading as a hazard surface rather than
    # cell-level noise when it is stretched over the basemap.
    s = ndi.gaussian_filter(score[::step, ::step], sigma=3.4)

    if kind == "flood":
        stops = [(0, (8, 168, 148)), (30, (32, 178, 170)), (50, (56, 189, 248)),
                 (66, (250, 204, 21)), (82, (249, 115, 22)), (100, (239, 68, 68))]
        a0, a1 = 40.0, 30.0
    else:
        stops = [(0, (252, 235, 150)), (38, (252, 176, 84)), (60, (246, 116, 116)),
                 (80, (206, 64, 132)), (100, (138, 34, 104))]
        a0, a1 = 0.0, 0.0  # heat uses its own alpha rule below

    pos = np.array([p for p, _ in stops], dtype=np.float32)
    cols = np.array([c for _, c in stops], dtype=np.float32)
    flat = s.reshape(-1)
    r = np.interp(flat, pos, cols[:, 0])
    g = np.interp(flat, pos, cols[:, 1])
    b = np.interp(flat, pos, cols[:, 2])
    if kind == "flood":
        a = np.clip((flat - a0) / a1, 0, 1) ** 0.85 * 200.0
        a = np.where(flat < a0, 0, a)
    else:
        # Heat is a regional field: keep it a readable haze, never a slab.
        a = np.clip(flat / 100.0, 0, 1) ** 1.15 * 128.0
        a = np.where(flat < 2, 0, a)

    rgba = np.zeros((*s.shape, 4), np.uint8)
    rgba[..., 0] = r.reshape(s.shape).astype(np.uint8)
    rgba[..., 1] = g.reshape(s.shape).astype(np.uint8)
    rgba[..., 2] = b.reshape(s.shape).astype(np.uint8)
    rgba[..., 3] = a.reshape(s.shape).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)
    print(f"  {path.name:20s} {path.stat().st_size/1024:6.0f} KB  {rgba.shape[1]}x{rgba.shape[0]}")


def write_grid(score: np.ndarray, path: Path, w: int = 384) -> None:
    H, W = score.shape
    step = max(1, W // w)
    hh = (H // step) * step
    g = score[:hh, : w * step].reshape(hh // step, step, w, step).mean(axis=(1, 3))
    g = ndi.gaussian_filter(g, 0.5)
    path.write_text(
        json.dumps(
            {"w": int(g.shape[1]), "h": int(g.shape[0]), "v": [int(round(v)) for v in g.reshape(-1)]},
            separators=(",", ":"),
        )
    )
    print(f"  {path.name:20s} {path.stat().st_size/1024:6.0f} KB  {g.shape[1]}x{g.shape[0]}")


if __name__ == "__main__":
    main()
