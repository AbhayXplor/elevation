"""
Build the exposure book and run the physical-risk financial engine.

Every facility is snapped to a real Overture building footprint, so the map shows
the actual asset the loan is secured on rather than a pin in a field.

Damage uses Hazus-style depth-damage curves per occupancy, integrated across
return periods to an expected annual loss (EAL). Financial outputs follow the way
CBUAE C 8/2025 asks a bank to look at them: customer-level exposure, collateral
haircut, and LTV after haircut — computed for the baseline and both forward
scenarios so the numbers move with the map.
"""
from __future__ import annotations

import json
from pathlib import Path

import duckdb
import numpy as np
from shapely import wkb as shapely_wkb

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SRC = ROOT / "src" / "data"

rng = np.random.default_rng(20261110)

# Same multipliers the hazard rasters use, so scores and depths stay consistent
# with what the map shows.
SCEN = {"now": 1.00, "2030": 1.14, "2050": 1.34}

DISTRICTS = {
    "Jebel Ali Free Zone": (55.045, 24.990),
    "Al Quoz": (55.228, 25.135),
    "Dubai Investments Park": (55.160, 24.980),
    "Business Bay": (55.268, 25.186),
    "DIFC": (55.281, 25.214),
    "Deira": (55.322, 25.266),
    "Bur Dubai": (55.296, 25.255),
    "Barsha Heights": (55.184, 25.096),
    "Jumeirah Lakes Towers": (55.141, 25.069),
    "Dubai Silicon Oasis": (55.379, 25.121),
    "International City": (55.408, 25.159),
    "Mirdif": (55.418, 25.219),
    "Dubai South": (55.148, 24.958),
    "Dubai Marina": (55.139, 25.080),
    "Al Awir": (55.468, 25.178),
    "Nad Al Sheba": (55.318, 25.148),
    "Al Nahda": (55.358, 25.288),
    "Al Karama": (55.303, 25.246),
    "Al Sufouh": (55.160, 25.100),
    "Expo City": (55.146, 24.955),
}

CURVES = {
    "warehouse": [(0, 0), (0.3, 0.06), (0.6, 0.14), (1.0, 0.26), (1.5, 0.38), (2.0, 0.47), (3.0, 0.58)],
    "office": [(0, 0), (0.3, 0.10), (0.6, 0.20), (1.0, 0.32), (1.5, 0.44), (2.0, 0.53), (3.0, 0.63)],
    "retail": [(0, 0), (0.3, 0.12), (0.6, 0.24), (1.0, 0.38), (1.5, 0.50), (2.0, 0.58), (3.0, 0.68)],
    "residential": [(0, 0), (0.3, 0.11), (0.6, 0.21), (1.0, 0.33), (1.5, 0.44), (2.0, 0.53), (3.0, 0.62)],
    "hospitality": [(0, 0), (0.3, 0.14), (0.6, 0.27), (1.0, 0.42), (1.5, 0.54), (2.0, 0.63), (3.0, 0.72)],
    "healthcare": [(0, 0), (0.3, 0.15), (0.6, 0.28), (1.0, 0.43), (1.5, 0.55), (2.0, 0.64), (3.0, 0.73)],
    "industrial": [(0, 0), (0.3, 0.08), (0.6, 0.18), (1.0, 0.31), (1.5, 0.43), (2.0, 0.52), (3.0, 0.64)],
}

RETURN_PERIODS = [(10, 0.28), (25, 0.48), (50, 0.70), (100, 1.00), (250, 1.28)]

PSQM = {"warehouse": 2600, "industrial": 3200, "office": 5400, "retail": 4800,
        "residential": 6200, "hospitality": 8500, "healthcare": 7800}
DEFAULT_H = {"warehouse": 9, "industrial": 10, "office": 34, "retail": 12,
             "residential": 46, "hospitality": 58, "healthcare": 22}

CUSTOMERS = [
    ("Al Mirqab Logistics Group", "Logistics & freight", "warehouse", "Corporate", "Jebel Ali Free Zone", 4, 420, 610, "BBB"),
    ("Rasid Industrial Holdings", "Light manufacturing", "industrial", "Corporate", "Al Quoz", 3, 285, 380, "BB+"),
    ("Falaj Cold Chain", "Cold storage", "warehouse", "Corporate", "Dubai Investments Park", 3, 190, 265, "BB"),
    ("Nakheel Shore Hospitality", "Hotels & resorts", "hospitality", "Corporate", "Dubai Marina", 2, 510, 720, "BBB-"),
    ("Bayt Al Waha Properties", "Real estate", "residential", "Corporate", "Business Bay", 4, 640, 870, "BB+"),
    ("Zenith Corporate Centre", "Commercial property", "office", "Corporate", "DIFC", 2, 380, 540, "A-"),
    ("Souq Al Madina Trading", "General trading", "retail", "SME", "Deira", 5, 96, 118, "BB"),
    ("Baraha Retail Partners", "Retail", "retail", "SME", "Bur Dubai", 3, 74, 92, "BB-"),
    ("Hikma Medical Centres", "Healthcare", "healthcare", "Corporate", "Barsha Heights", 3, 165, 210, "BBB"),
    ("Sahara Foods Processing", "Food manufacturing", "industrial", "Corporate", "Al Quoz", 2, 140, 185, "BB+"),
    ("Marasi Marine Services", "Marine services", "industrial", "SME", "Jebel Ali Free Zone", 2, 88, 112, "BB"),
    ("Qasr Al Reem Hospitality", "Hotels & resorts", "hospitality", "Corporate", "Business Bay", 1, 310, 430, "BBB-"),
    ("Tijara Warehousing", "Warehousing", "warehouse", "SME", "International City", 4, 118, 146, "BB"),
    ("Nujoom Tech Park", "Technology", "office", "Corporate", "Dubai Silicon Oasis", 3, 205, 258, "BBB"),
    ("Wadi Auto Parts", "Automotive distribution", "warehouse", "SME", "Al Awir", 2, 62, 78, "BB-"),
    ("Bustan Agri Farms", "Agriculture", "warehouse", "SME", "Al Awir", 3, 54, 71, "BB-"),
    ("Sidra Tower Residences", "Residential property", "residential", "Corporate", "Jumeirah Lakes Towers", 3, 430, 585, "BBB"),
    ("Meydan Equestrian Estates", "Leisure & equestrian", "residential", "Corporate", "Nad Al Sheba", 2, 175, 240, "BBB-"),
    ("Al Khor Trading Est.", "General trading", "retail", "SME", "Al Karama", 3, 58, 70, "B+"),
    ("Rafeeq Facilities Management", "Facilities services", "office", "SME", "Al Nahda", 2, 44, 55, "BB-"),
    ("Dhow Gate Shipping", "Shipping & forwarding", "warehouse", "Corporate", "Dubai South", 3, 232, 296, "BBB-"),
    ("Aeropark Cargo Services", "Air cargo handling", "warehouse", "Corporate", "Dubai South", 2, 268, 340, "BBB"),
    ("Muntada Events Group", "Events & exhibitions", "hospitality", "SME", "Expo City", 2, 81, 96, "BB"),
    ("Safa Engineering Works", "Engineering", "industrial", "SME", "Al Quoz", 2, 72, 90, "BB-"),
    ("Hajjar Building Materials", "Building materials", "warehouse", "SME", "Dubai Investments Park", 2, 69, 85, "BB-"),
    ("Lulu Gardens Landscaping", "Landscaping", "warehouse", "SME", "Mirdif", 1, 31, 39, "B+"),
    ("Sadaf Retail Holdings", "Retail", "retail", "Corporate", "Mirdif", 2, 156, 198, "BBB-"),
    ("Kanz Data Centres", "Data centres", "industrial", "Corporate", "Dubai Silicon Oasis", 2, 395, 505, "A-"),
]


def damage_ratio(curve, depth_m: float) -> float:
    xs = np.array([p[0] for p in curve], dtype=float)
    ys = np.array([p[1] for p in curve], dtype=float)
    return float(np.interp(max(depth_m, 0.0), xs, ys))


def eal_curve(curve, depth_100: float) -> float:
    losses, probs = [], []
    for rp, mult in RETURN_PERIODS:
        losses.append(damage_ratio(curve, depth_100 * mult))
        probs.append(1.0 / rp)
    eal = 0.0
    for i in range(len(RETURN_PERIODS) - 1):
        eal += 0.5 * (losses[i] + losses[i + 1]) * (probs[i] - probs[i + 1])
    return eal


def score_to_depth(score: float) -> float:
    """Susceptibility index -> 1-in-100-year ponding depth (metres).

    Anchors calibrated to ponding depths reported during the April 2024 event:
    0.2-0.5 m on ordinary streets, up to 1.5-2.0 m in the worst basins.
    """
    return float(np.interp(score, [0, 30, 45, 55, 70, 85, 100], [0.0, 0.02, 0.10, 0.25, 0.55, 1.10, 2.00]))


def simplify_ring(geom, tol=0.000045):
    g = geom.simplify(tol, preserve_topology=True)
    if g.is_empty:
        g = geom
    if g.geom_type == "MultiPolygon":
        g = max(g.geoms, key=lambda p: p.area)
    if g.geom_type != "Polygon":
        return None
    ring = list(g.exterior.coords)
    return [[round(x, 6), round(y, 6)] for x, y in ring] if len(ring) >= 4 else None


def main() -> None:
    model = json.loads((DATA / "model.json").read_text())
    meta = json.loads((DATA / "terrain.meta.json").read_text())
    grid = model["grid"]

    flood_grid = json.loads((DATA / "grid_flood.json").read_text())
    heat_grid = json.loads((DATA / "grid_heat.json").read_text())
    fw, fh = flood_grid["w"], flood_grid["h"]
    hw, hh = heat_grid["w"], heat_grid["h"]
    fv, hv = flood_grid["v"], heat_grid["v"]

    def sample(lon, lat, vals, w, h):
        n = 2 ** grid["z"] * 256
        px = ((lon + 180.0) / 360.0) * n
        lr = np.radians(lat)
        py = ((1.0 - np.log(np.tan(lr) + 1.0 / np.cos(lr)) / np.pi) / 2.0) * n
        ix = int(np.clip((px - meta["x0"] * 256.0) / (meta["width_px"] / w), 0, w - 1))
        iy = int(np.clip((py - meta["y0"] * 256.0) / (meta["height_px"] / h), 0, h - 1))
        return float(vals[iy * w + ix])

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial; SET geometry_always_xy = true;")
    cand = con.execute(
        f"SELECT id, lon, lat, area_m2, subtype FROM '{(DATA / 'building_centroids.parquet').as_posix()}' WHERE subtype IS NOT NULL"
    ).fetchall()
    print(f"{len(cand)} candidate buildings with a known subtype")

    occ_subtype = {
        "warehouse": {"industrial", "commercial"},
        "industrial": {"industrial"},
        "office": {"commercial"},
        "retail": {"commercial", "retail"},
        "residential": {"residential"},
        "hospitality": {"commercial"},
        "healthcare": {"medical", "civic"},
    }
    area_target = {
        "warehouse": (900, 6000), "industrial": (700, 5000), "office": (1200, 9000),
        "retail": (400, 4000), "residential": (800, 7000), "hospitality": (2500, 14000),
        "healthcare": (900, 6000),
    }

    ids = np.array([c[0] for c in cand], dtype=object)
    lons = np.array([c[1] for c in cand], dtype=float)
    lats = np.array([c[2] for c in cand], dtype=float)
    areas = np.array([c[3] for c in cand], dtype=float)
    subs = np.array([c[4] for c in cand], dtype=object)

    customers = []
    used: set[str] = set()
    fid = 0

    for idx, (name, sector, occ, segment, district, nfac, exp_m, col_m, rating) in enumerate(CUSTOMERS):
        clon, clat = DISTRICTS[district]
        mask = (
            np.isin(subs, list(occ_subtype[occ]))
            & (areas >= area_target[occ][0])
            & (areas <= area_target[occ][1])
            & (np.abs(lons - clon) < 0.03)
            & (np.abs(lats - clat) < 0.03)
        )
        cand_idx = np.where(mask)[0]

        picks = []
        for k in range(nfac):
            if len(cand_idx) == 0:
                break
            ang = rng.uniform(0, 2 * np.pi)
            rad = rng.uniform(0, 0.012) * (1 + k * 0.4)
            tx, ty = clon + rad * np.cos(ang), clat + rad * np.sin(ang)
            d = (lons[cand_idx] - tx) ** 2 + (lats[cand_idx] - ty) ** 2
            for j in np.argsort(d)[:40]:
                ci = cand_idx[j]
                if ids[ci] not in used:
                    used.add(ids[ci])
                    picks.append(ci)
                    break

        if not picks:
            continue

        idlist = ", ".join(f"'{ids[p]}'" for p in picks)
        geo = con.execute(
            f"SELECT id, ST_AsWKB(geometry), height, num_floors FROM '{(DATA / 'buildings.parquet').as_posix()}' WHERE id IN ({idlist})"
        ).fetchall()
        gmap = {r[0]: (r[1], r[2], r[3]) for r in geo}

        out_fac = []
        for p in picks:
            g = gmap.get(ids[p])
            if not g:
                continue
            ring = simplify_ring(shapely_wkb.loads(g[0]))
            if ring is None:
                continue
            h = g[1] or (g[2] * 3.2 if g[2] else None)
            if not h or h <= 0:
                h = DEFAULT_H[occ]

            lon, lat = float(lons[p]), float(lats[p])
            fscore = sample(lon, lat, fv, fw, fh)
            hscore = sample(lon, lat, hv, hw, hh)

            # Heat scenarios scale by the ratio of the ERA5 scenario scores so
            # facilities move with the heat layer as well as the flood layer.
            heat_cfg = json.loads((DATA / "heat.json").read_text())["scenarios"]
            heat_now = max(heat_cfg["now"]["score"], 1e-6)
            heat_scen = {
                k: round(min(100.0, hscore * (v["score"] / heat_now)), 1)
                for k, v in heat_cfg.items()
            }
            value = float(areas[p]) * PSQM[occ] * (1 + min(h / 40.0, 1.6) * 0.25)
            curve = CURVES[occ]

            sc = {}
            for sname, mult in SCEN.items():
                s_score = min(100.0, fscore * mult)
                depth = score_to_depth(s_score)
                dmg = damage_ratio(curve, depth)
                sc[sname] = {
                    "score": round(s_score, 1),
                    "depth": round(depth, 3),
                    "damage": round(dmg, 4),
                    "loss": round(dmg * value),
                    "eal": round(eal_curve(curve, depth) * value),
                }

            fid += 1
            out_fac.append(
                {
                    "id": f"F-{fid:03d}",
                    "name": f"{name.split()[0]} · {district}",
                    "district": district,
                    "lon": round(lon, 6),
                    "lat": round(lat, 6),
                    "areaM2": round(float(areas[p])),
                    "heightM": round(float(h), 1),
                    "assetValue": round(value),
                    "floodScore": round(fscore, 1),
                    "heatScore": round(hscore, 1),
                    "heatScenarios": heat_scen,
                    "ring": ring,
                    "scenarios": sc,
                }
            )

        if not out_fac:
            continue

        exposure = exp_m * 1_000_000
        collateral = col_m * 1_000_000
        margin = exposure * rng.uniform(0.019, 0.032)
        tenor = int(rng.choice([3, 4, 5, 7, 10]))
        total_asset = sum(f["assetValue"] for f in out_fac)

        sc_c: dict[str, dict] = {}
        for sname in SCEN:
            aal = sum(f["scenarios"][sname]["eal"] for f in out_fac)
            loss = sum(f["scenarios"][sname]["loss"] for f in out_fac)
            dmg = loss / total_asset if total_asset else 0.0
            haircut = min(0.30, dmg)
            adj = collateral * (1 - haircut)
            sc_c[sname] = {
                "aal": round(aal),
                "loss100": round(loss),
                "damage100": round(dmg, 4),
                "haircut": round(haircut, 4),
                "ltvAfter": round(min(exposure / adj, 9.99) if adj > 0 else 9.99, 4),
                "worstDepth": round(max(f["scenarios"][sname]["depth"] for f in out_fac), 3),
                "floodScore": round(max(f["scenarios"][sname]["score"] for f in out_fac), 1),
            }

        customers.append(
            {
                "id": f"C-{idx + 1:02d}",
                "name": name,
                "sector": sector,
                "occupancy": occ,
                "segment": segment,
                "rating": rating,
                "tenorYears": tenor,
                "exposure": round(exposure),
                "collateralValue": round(collateral),
                "annualMargin": round(margin),
                "ltv": round(exposure / collateral, 4),
                "assetValue": round(total_asset),
                "heatScore": round(max(f["heatScore"] for f in out_fac), 1),
                "facilities": out_fac,
                "scenarios": sc_c,
            }
        )

    # ---- roll-ups ------------------------------------------------------
    def roll(sel):
        exp = sum(c["exposure"] for c in customers)
        col = sum(c["collateralValue"] for c in customers)
        margin = sum(c["annualMargin"] for c in customers)
        asset = sum(c["assetValue"] for c in customers)
        out = {
            "customers": len(customers),
            "facilities": sum(len(c["facilities"]) for c in customers),
            "exposure": round(exp),
            "collateral": round(col),
            "annualMargin": round(margin),
            "assetValue": round(asset),
        }
        for sname in SCEN:
            aal = sum(c["scenarios"][sname]["aal"] for c in customers)
            loss = sum(c["scenarios"][sname]["loss100"] for c in customers)
            out[sname] = {
                "aal": round(aal),
                "aalRatio": round(aal / exp, 5),
                "aalVsMargin": round(aal / margin, 4),
                "loss100": round(loss),
                "loss100PctAsset": round(loss / asset, 4),
                "ltvBreach": sum(1 for c in customers if c["scenarios"][sname]["ltvAfter"] > 0.9),
                "newBreach": sum(
                    1
                    for c in customers
                    if c["scenarios"][sname]["ltvAfter"] > 0.9 and c["ltv"] <= 0.9
                ),
                "haircutWeighted": round(
                    sum(c["collateralValue"] * c["scenarios"][sname]["haircut"] for c in customers) / col,
                    4,
                ),
            }
        del sel
        return out

    by_district: dict[str, float] = {}
    for c in customers:
        for f in c["facilities"]:
            by_district[f["district"]] = by_district.get(f["district"], 0) + f["assetValue"]

    by_sector: dict[str, float] = {}
    for c in customers:
        by_sector[c["sector"]] = by_sector.get(c["sector"], 0) + c["exposure"]

    payload = {
        "asOf": "2026-11-10",
        "currency": "AED",
        "institution": "Emirates Commercial Bank",
        "scenarios": SCEN,
        "totals": roll(None),
        "byDistrict": sorted(
            [
                {
                    "district": k,
                    "assetValue": round(v),
                    "floodScore": round(
                        np.mean(
                            [
                                f["floodScore"]
                                for c in customers
                                for f in c["facilities"]
                                if f["district"] == k
                            ]
                        ),
                        1,
                    ),
                }
                for k, v in by_district.items()
            ],
            key=lambda x: -x["assetValue"],
        ),
        "bySector": sorted(
            [{"sector": k, "exposure": round(v)} for k, v in by_sector.items()],
            key=lambda x: -x["exposure"],
        ),
        "customers": customers,
    }

    SRC.mkdir(parents=True, exist_ok=True)
    (SRC / "portfolio.json").write_text(json.dumps(payload, separators=(",", ":")))

    t = payload["totals"]
    print(f"\n{len(customers)} customers, {t['facilities']} facilities")
    print(f"exposure AED {t['exposure']/1e9:.2f}bn  collateral AED {t['collateral']/1e9:.2f}bn")
    for sname in SCEN:
        s = t[sname]
        print(
            f"  {sname:5s} loss100 AED {s['loss100']/1e6:6.1f}m  "
            f"AAL AED {s['aal']/1e6:5.2f}m  breach {s['ltvBreach']:2d}  "
            f"weighted haircut {s['haircutWeighted']*100:4.1f}%"
        )
    print(f"file {(SRC / 'portfolio.json').stat().st_size/1024:.0f} KB")


if __name__ == "__main__":
    main()
