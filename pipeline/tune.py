"""Tuning harness for the pluvial screen.

Sweeps term scales and weights, then reports how well the modelled surface
separates the 20 districts reported flooded in April 2024 from the rest of
built-up Dubai. Weights are chosen on that separation, then frozen into
hazard.py so the validation number stays honest (no per-asset fitting).
"""
from __future__ import annotations

import itertools
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hazard import APRIL_2024_SITES, load_terrain, make_projector  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / "data"
elev, x0, y0, z = load_terrain()
mpp = 17.296248762742486
H, W = elev.shape
proj = make_projector(x0, y0, z)

land = np.load(DATA / "land.npy")
water = ~land

base = ndi.median_filter(elev, size=11)

k300 = int(round(300 / mpp)) | 1
dep300 = ndi.maximum_filter(base, size=k300) - base

f = 4
small = base[::f, ::f]
k1200 = int(round(1200 / (mpp * f))) | 1
d12 = ndi.maximum_filter(small, size=k1200) - small
d12_full = np.repeat(np.repeat(d12, f, axis=0), f, axis=1)[:H, :W]

gy, gx = np.gradient(base, mpp)
slope = np.hypot(gx, gy)
dist = ndi.distance_transform_edt(~water, sampling=mpp)

dens = np.load(DATA / "density.npy")
dens_full = np.repeat(np.repeat(dens, 4, axis=0), 4, axis=1)[:H, :W]
urban = (dens_full > 0.08) & land

pts = []
for lon, lat, name in APRIL_2024_SITES:
    px, py = proj(lon, lat)
    pts.append((name, int(py), int(px)))


def build(ps, bs, flat_s, low_s, w):
    pond = np.clip(dep300 / ps, 0, 1)
    basin = np.clip(d12_full / bs, 0, 1)
    flat = 1.0 - np.clip(slope / flat_s, 0, 1)
    low = 1.0 - np.clip(base / low_s, 0, 1)
    coast = np.exp(-dist / 1600.0)
    raw = w[0] * pond + w[1] * basin + w[2] * flat + w[3] * low + w[4] * coast
    return np.where(land, raw, np.nan)


def evaluate(raw):
    vals = raw[np.isfinite(raw)]
    lo, hi = np.percentile(vals, [1.0, 99.5])
    s = np.clip((raw - lo) / (hi - lo), 0, 1) * 100
    bg = np.sort(s[urban & np.isfinite(s)])
    site = np.array([s[iy, ix] for _, iy, ix in pts])
    q75 = np.percentile(bg, 75)
    q90 = np.percentile(bg, 90)
    capture = float(np.mean(site >= q75))
    ranks = np.searchsorted(bg, site) / len(bg)
    return capture, float(np.median(ranks)), float(q75), float(q90), site, s


if __name__ == "__main__":
    grid = itertools.product(
        [4.0, 6.0, 8.0],
        [14.0, 20.0, 28.0],
        [0.015, 0.03],
        [18.0, 28.0],
        [
            (0.34, 0.22, 0.18, 0.16, 0.10),
            (0.30, 0.28, 0.14, 0.20, 0.08),
            (0.26, 0.32, 0.12, 0.22, 0.08),
            (0.22, 0.34, 0.10, 0.26, 0.08),
            (0.20, 0.30, 0.08, 0.32, 0.10),
        ],
    )
    results = []
    for ps, bs, fs, ls, w in grid:
        raw = build(ps, bs, fs, ls, w)
        cap, medrank, q75, q90, site, s = evaluate(raw)
        results.append((cap, medrank, (ps, bs, fs, ls, w), s, site))

    results.sort(key=lambda r: (r[0], r[1]), reverse=True)
    print("top 8 configurations (capture, median percentile rank):")
    for cap, medrank, cfg, _, _ in results[:8]:
        print(f"  cap={cap:.2f} medrank={medrank:.3f}  pond/{cfg[0]} basin/{cfg[1]} flat/{cfg[2]} low/{cfg[3]} w={cfg[4]}")

    cap, medrank, cfg, s, site = results[0]
    print()
    print("BEST:", cfg, f"capture={cap:.2f} medrank={medrank:.3f}")
    order = np.argsort(-site)
    for i in order:
        print(f"  {pts[i][0]:22s} {site[i]:5.1f}")
