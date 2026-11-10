"""
Heat climatology for Dubai from the Open-Meteo ERA5 archive (keyless),
projected forward with CMIP6 SSP2-4.5 deltas.

We store threshold-exceedance counts for the observed decade, then express the
forward scenarios as shifts in those counts using the classic temperature
distribution shift (a uniform +Δ°C translation of Tmax).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

URL = "https://archive-api.open-meteo.com/v1/archive"
PARAMS = {
    "latitude": 25.20,
    "longitude": 55.27,
    "start_date": "2015-01-01",
    "end_date": "2024-12-31",
    "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean",
    "timezone": "Asia/Dubai",
}

# CMIP6 SSP2-4.5 mid-range warming for the Arabian Peninsula, relative to the
# 2015-2024 baseline (IPCC AR6 WGI regional atlas / UAE 3rd National Communication).
DELTAS = {"now": 0.0, "2030": 0.9, "2050": 2.2}


def exceed(daily: np.ndarray, thr: float, delta: float) -> float:
    return float(np.mean(daily + delta >= thr) * 365.25)


def main() -> None:
    r = requests.get(URL, params=PARAMS, timeout=60)
    r.raise_for_status()
    d = r.json()["daily"]
    tmax = np.array([v for v in d["temperature_2m_max"] if v is not None], dtype=np.float32)
    tmin = np.array([v for v in d["temperature_2m_min"] if v is not None], dtype=np.float32)
    tmen = np.array([v for v in d["temperature_2m_mean"] if v is not None], dtype=np.float32)
    print(f"ERA5 Dubai: {len(tmax)} days, Tmax mean {tmax.mean():.1f}C, p99 {np.percentile(tmax,99):.1f}C")

    base = {
        "tmax_mean_c": round(float(tmax.mean()), 2),
        "tmax_p99_c": round(float(np.percentile(tmax, 99)), 2),
        "tmax_record_c": round(float(tmax.max()), 2),
        "tmin_mean_c": round(float(tmin.mean()), 2),
        "days_over_40c": round(exceed(tmax, 40.0, 0.0), 1),
        "days_over_45c": round(exceed(tmax, 45.0, 0.0), 1),
        "nights_over_30c": round(float(np.mean(tmin >= 30.0) * 365.25), 1),
        "cdd_18c": round(float(np.maximum(tmen - 18.0, 0).sum() / 10.0), 0),
    }

    scenarios = {}
    for name, delta in DELTAS.items():
        d40 = exceed(tmax, 40.0, delta)
        d45 = exceed(tmax, 45.0, delta)
        n30 = float(np.mean(tmin + delta >= 30.0) * 365.25)
        d50 = exceed(tmax, 50.0, delta)
        # 0-100 hazard score: weighted exceedance, saturating at extreme values.
        score = (
            45.0 * min(d45 / 22.0, 1.0)
            + 20.0 * min(d40 / 95.0, 1.0)
            + 20.0 * min(n30 / 120.0, 1.0)
            + 15.0 * min(d50 / 4.0, 1.0)
        )
        scenarios[name] = {
            "delta_c": delta,
            "days_over_40c": round(d40, 1),
            "days_over_45c": round(d45, 1),
            "days_over_50c": round(d50, 2),
            "nights_over_30c": round(n30, 1),
            "score": round(min(score, 100.0), 1),
        }

    out = {"baseline": base, "scenarios": scenarios, "source": "open-meteo ERA5 archive"}
    (DATA / "heat.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
