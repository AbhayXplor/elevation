# Elevation

Physical climate risk, priced into a bank's loan book.

Elevation takes open satellite, terrain and reanalysis data and answers a question a UAE
bank cannot currently answer cheaply: **which buildings in our collateral pool will flood,
how deep will the water get, what does that do to the loan-to-value, and what do we have to
disclose?**

Every hazard score and loss figure is computed by the Python pipeline in this repository
from public data, and the whole thing runs in a browser with no backend.

Built for **UAE Hackathon 2026, Pioneers track** (HCT Dubai Student Campus, 9-11 November).

---

## The problem

A corporate loan is usually secured on a building. That building sits at a specific point on
a specific piece of terrain. In a city that already spends 72 days a year above 40 °C, and
will spend 120 by 2050, that point has a measurable chance of being under water.

Banks know this in aggregate but not in detail. Property-level catastrophe models cost six
figures a year and are built for insurers, not lenders. So physical risk gets handled as a
qualitative line in a policy document, disconnected from the actual collateral schedule.

CBUAE's *Climate-related Financial Risk Management Regulation* (C 8/2025) removes that
option. Banks have to identify, measure and disclose physical risk at exposure level.
Elevation is a working answer to what that looks like when you build it from data you can
actually get.

---

## What it does

Five screens and a borrower drill-down, over one book: 27 borrowers, 68 geocoded facilities,
AED 5.69bn of exposure secured on AED 7.61bn of collateral.

The layout is responsive down to a 390 px phone, since the pitch uses a QR code: the sidebar
becomes a bottom tab bar, panels stack, and the wide tables scroll inside their own panel
rather than pushing the page sideways.

| Screen | What it answers |
|---|---|
| **Overview** | Where the risk sits across the book: exposure, 1-in-100 loss, expected annual loss, LTV breaches, by district and by forward scenario. |
| **Exposure map** | The hazard field itself. Pluvial and heat layers, real building footprints extruded to their actual heights, 3D view, click anywhere to sample the score. |
| **Borrowers** | The full book as a sortable, filterable table. Search, segment, drill into any borrower. |
| **Borrower detail** | One borrower in full: facilities on a mini-map, depth and damage per scenario, post-haircut LTV, and an exported evidence record mapped to the six CBUAE clauses it satisfies. |
| **Model & evidence** | The methodology and the validation result, including what failed. |
| **CRFR2 disclosure** | The same book as a regulatory determination: Subject / Not subject / Cannot determine, with CSV and audit JSON export. |

Scenarios switch the entire application at once: **baseline**, **2030** and **2050**.

---

## How it works

```
  Copernicus GLO-30 DEM ─┐
  Overture water         ├─► terrain grid (17.3 m/px) ─► pluvial susceptibility ─┐
  Overture buildings ────┘                                                       │
                                                                                 ├─► score grid
  ERA5 2015-24 + CMIP6 SSP2-4.5 ──────────────► heat climatology ────────────────┘   (384 x 416)
                                                                                 │
  portfolio.json (borrowers, facilities, collateral) ────────────────────────────┤
                                                                                 ▼
                                             per-facility depth ─► damage ─► loss ─► EAL
                                                                                 │
                                                                                 ▼
                                             haircut ─► post-haircut LTV ─► CRFR2 determination
```

The pipeline runs offline. It writes a score grid, three flood overlays, three heat overlays
and a portfolio JSON. The frontend reads those files and does no computation of its own
beyond sorting and formatting.

That split is deliberate: **the hazard layer is swappable.** The financial engine only ever
consumes a score between 0 and 100 per grid cell. Replacing the open-data screen with a
licensed model (JBA, Climate X, or a bank's own) changes one file, not the finance.

---

## The hazard model

### Pluvial flooding

Dubai's April 2024 event was not a river flood. It was rain that fell faster than a flat,
heavily paved city could drain it, and pooled in whatever was low.

So the screen models ponding, not channels:

1. Copernicus GLO-30 elevation, reprojected to Web Mercator z13 at **17.3 m per pixel**.
2. Overture water polygons rasterised to separate real land from the Gulf, the Creek and the
   marinas.
3. Multi-scale depression depth at 300 m and 1200 m neighbourhoods, inverse slope, inverse
   elevation and coastal proximity, combined into a susceptibility index.
4. Index mapped to a 1-in-100-year ponding depth through anchors calibrated to depths
   reported during April 2024: 0.2-0.5 m on ordinary streets, up to 2.0 m in the worst basins.

D8 flow accumulation was implemented and then **removed**. It made the validation worse
(median percentile rank 0.81 to 0.77), so it is not in the model. That decision is recorded
in `public/geo/model.json` alongside the parameters that survived.

Forward scenarios scale the index by 1.14 (2030) and 1.34 (2050).

### Heat

ERA5 reanalysis for Dubai, 2015-2024, as the baseline: mean daily maximum **33.43 °C**,
**72.1 days** above 40 °C, **45.9 nights** above 30 °C. CMIP6 SSP2-4.5 deltas move this to
+0.9 °C by 2030 and +2.2 °C by 2050, which takes days above 40 °C to 91 and then 121.
A built-up density proxy from 470,294 Overture building footprints adds the urban heat
island component.

---

## Validation

The test: 20 districts that reported flooding in April 2024. If the screen is informative,
they should cluster in the top quartile of built-up Dubai.

| | |
|---|---|
| Districts in the top quartile | **12 of 20** |
| Expected if the model were random | 5 |
| Median percentile rank | **0.81** |
| Top-quartile threshold | 54.8 |
| P90 threshold | 66.7 |

### The honest caveat

Those weights were selected by sweeping **180 configurations** against the same 20
districts, so 12/20 is an **in-sample** figure, not a held-out one. Quoting it alone would
overstate what has been demonstrated.

So the sweep publishes its whole distribution, not just the winner:

| | Configurations |
|---|---|
| Best | 12 of 20 |
| 90th percentile | 12 of 20 |
| Median | 11 of 20 |
| Worst | 9 of 20 |

Every one of the 180 configurations beats the 5-of-20 chance baseline, and 17% reach the
top result. The model is not a single lucky parameter set — but it is still fitted on the
same districts it is scored against. A held-out set of districts, and a comparison against
an independent hazard model, is the next step (see [Roadmap](#roadmap-90-days)).

---

## The financial engine

For each facility, per scenario:

**Depth.** Score to depth through the anchors above.

**Damage.** Hazus-style depth-damage curve chosen by occupancy (warehouse, industrial,
office, retail, residential, hospitality, healthcare). Full curves are in
`pipeline/portfolio.py`.

**Loss.** `asset value x damage ratio`.

**Expected annual loss.** Not a flat percentage. EAL integrates the damage curve across
return periods of 10, 25, 50, 100 and 250 years by trapezoid, so the result reflects the
shape of the loss distribution rather than a single point on it.

**Haircut.** `min(0.30, damage ratio at 1-in-100)`, applied to collateral value.

**Post-haircut LTV.** `exposure / (collateral x (1 - haircut))`. A borrower breaches above
**0.90**.

### What that produces

| | Baseline | 2030 | 2050 |
|---|---|---|---|
| 1-in-100 loss | AED 85.1m | AED 132.1m | AED 212.5m |
| Expected annual loss | AED 4.3m | AED 6.8m | AED 11.3m |
| Share of secured value impaired | 9.4% | 14.6% | 23.5% |
| LTV breaches | 3 | 9 | 14 |

Note the last row. Three breaches today is a provisioning question. Fourteen by 2050 is a
lending-strategy question, and it is the number that should change how a credit committee
prices a ten-year facility in Business Bay.

---

## The regulatory layer

Each determination is mapped to the clauses it draws on, so the output is an evidence record
rather than a dashboard:

| Clause | What the regulation requires | What Elevation produces |
|---|---|---|
| §4.7.2 | Integration at customer and portfolio level, across the relationship lifecycle | Exposure and 1-in-100 loss per borrower, and the same aggregated across the book |
| §4.7.4 | Magnitude of the customer's exposure to physical risk, and their mitigation record | Modelled pluvial score and worst ponding depth at each facility |
| §4.7.5 | Transmission channels from physical risk to financial risk | Collateral devaluation, and the LTV move it causes |
| §4.7.11 | Physical-risk metrics for geographic concentrations of assets and collateral | Facilities and districts per borrower, with correlated hazard |
| §4.10.2 | Liquidity-risk impact, including higher collateral haircuts in a less liquid market | The funding-side effect of the same haircut |
| §4.11.6 | Scenario-analysis outcomes for provisions, capital and liquidity against baseline | Expected annual loss against the margin the relationship earns |

Two clarifications, because precision here matters more than sounding impressive:

- The regulation is CBUAE's **Climate-related Financial Risk Management Regulation**, not a
  reporting standard. The disclosure duty sits inside it.
- **CRFR2** is a template label in the BCBS *voluntary* disclosure framework — *physical
  risk, exposures subject to physical risks* — not a mandatory BCBS document. The app labels
  its table CRFR2 because that is the template it mirrors.

Both exports are real files: a CSV of all 27 exposures and a JSON audit trail with the model
provenance attached.

---

## Running it

Requires **Node 20.19+** (built on 22.22) and npm.

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # typecheck + production build
npm run preview  # serve the build
npm run lint     # oxlint
```

No API keys, no database, no server. The basemap is OpenFreeMap, which is free and keyless,
so the only network dependency is tile fetching.

### Rebuilding the model

The generated artifacts are committed, so the app runs without Python. To regenerate them
you need Python 3.11+.

```bash
python -m venv .venv
.venv/Scripts/activate        # .venv/bin/activate on macOS/Linux
pip install -r pipeline/requirements.txt
```

```bash
cd pipeline
python fetch_dem.py     # download and reproject Copernicus GLO-30
python mask.py          # rasterise Overture water polygons
python buildings.py     # 470k footprints -> density raster
python heat.py          # ERA5 baseline + CMIP6 deltas
python tune.py          # sweep scales/weights against April 2024
python hazard.py        # build the score grids and overlays
python portfolio.py     # run the financial engine
```

Order matters: `tune.py` writes `data/tuning.json`, and `hazard.py` copies that distribution
into `model.json` so the app can disclose it. Copy `data/model.json`, the six
`data/grid_*.json` files and the six overlay PNGs into `public/geo/` afterwards.

Intermediate rasters (`data/`) are git-ignored. They are roughly 200 MB and rebuild cleanly.

---

## Repository layout

```
src/
  components/     Shell, map canvas, KPI cards, UI primitives
  views/          Overview, MapView, Portfolio, CustomerDetail, Evidence, Report
  lib/            format (money, bands, CSV, determination), store, types
  data/           portfolio.json - the computed book
public/geo/       score grids, flood/heat overlays, model.json provenance
pipeline/         the Python model, one script per stage
```

Roughly 2,900 lines of TypeScript and 1,200 of Python.

---

## Data sources

| Source | Used for | Licence |
|---|---|---|
| [Copernicus DEM GLO-30](https://dataspace.copernicus.eu/) | Terrain, ponding depth | Free, attribution |
| [Overture Maps](https://overturemaps.org/) | Building footprints, water polygons | ODbL / CDLA |
| [ERA5 via Open-Meteo](https://open-meteo.com/) | Historical heat climatology | CC BY 4.0 |
| [CMIP6 SSP2-4.5](https://www.wcrp-climate.org/wgcm-cmip) | Forward temperature deltas | Free, attribution |
| [OpenFreeMap](https://openfreemap.org/) | Basemap tiles | Free, no key |

---

## The written explanation

Each borrower page carries a short paragraph explaining, in plain English, why that borrower is
flagged. It is generated by Gemini from a facts object containing only the numbers already on
the page — the prompt forbids introducing any figure that was not handed to it — and it runs in a
single Vercel edge function so the key never reaches the browser.

The deterministic version is rendered immediately and stays if the request fails, so the screen
never depends on the model being reachable. Set `GEMINI_API_KEY` in the Vercel project's
environment variables; without it the endpoint returns 503 and the page falls back silently.

## Limitations

Stated plainly, because they matter more than the demo does.

- **This is a screen, not a catastrophe model.** It ranks relative risk at 17 m resolution.
  It does not model drainage networks, sewer capacity, or rainfall intensity directly.
- **The borrower book is synthetic.** The 27 borrowers, exposures and collateral values are
  constructed to resemble a mid-size UAE corporate book. The geography, hazard scores and
  loss outputs are computed, not scripted.
- **The damage curves are Hazus-*style*** — hand-specified from FEMA's published methodology
  rather than loaded from the Hazus software. They are a US calibration, and UAE-specific
  curves would move the loss numbers, though not the ranking.
- **Validation is in-sample.** The weights were chosen on the same 20 districts they are
  scored against. The sweep publishes its whole distribution for that reason, but a held-out
  set is what would make the number defensible.
- **The April 2024 anchors are 20 single points** — one pixel per district, snapped to land.
  The validation asks whether the *district* ranks highly, not whether that specific pixel
  flooded.
- **Depth is a lookup, not a measurement.** Depth is mapped from the susceptibility index
  through a monotone anchor, so it is a screening depth, never a surveyed one.
- **Heat affects the asset, not yet the borrower.** The heat layer is modelled and mapped but
  only enters the financial engine through a separate score, not through revenue or
  business-interruption effects.
- **17 m resolution misses street-level drainage.** Two buildings on the same block get the
  same score even if one sits in a sump.

None of these are hidden in the app. The Model & evidence screen shows the validation result
next to the methodology, including the removed D8 term.

---

## Hackathon

UAE Hackathon 2026, ninth edition, theme *Beyond Ideas, Into Impact*.
Track 2, **Pioneers** (HCT Dubai Student Campus, 9-11 November 2026).

Pioneers deliverables are an innovative idea and a Business Model Canvas. This repository is
the working prototype behind both.

| Judging criterion | Weight | Where to look |
|---|---|---|
| Alignment with challenge and impact | 20% | CBUAE C 8/2025 disclosure built end to end |
| Effective use of data | 15% | Five public sources, reproducible pipeline, validation against April 2024 |
| Innovative use of AI and emerging technologies | 15% | Terrain-based flood screen, CMIP6 projection, no licensed model required |
| Solution feasibility and planning | 20% | One `npm install` to run; hazard layer swappable for a licensed model |
| Market potential and commercialisation | 15% | Sold to banks and regulators as a screening layer under cat models |
| Presentation, clarity and creativity | 25% | The five screens above |

Weights as published on hackathon.ae for the Pioneers track.

---

## Roadmap (90 days)

The brief asks for an execution plan, so this is the one we would run with a pilot bank.

| Days | Workstream | Milestone |
|---|---|---|
| 1–15 | Data intake | A pilot extract of ~1,000 corporate facilities replaces the synthetic book; facilities geocoded against municipal records and collateral values reconciled |
| 16–30 | Hazard validation | The screen cross-checked against JRC GloFAS river-flood depths and one SFINCS hydraulic run on a district that flooded in April 2024; agreement and disagreement both documented |
| 31–45 | Vulnerability | Hand-calibrated curves replaced with the published JRC global depth-damage functions; sensitivity run at ±25% depth |
| 46–60 | Model risk | Independent review, backtest against the bank's actual April 2024 claims, limitations signed off by the model risk function |
| 61–75 | Workflow | The CRFR2 export wired into the credit memo and the annual ICAAP pack; piloted with two relationship managers |
| 76–90 | Decision | Go/no-go on licensed hazard data; production refresh cadence and service level agreed |

The gate is day 30. If the open screen does not agree with an independent hazard model on
real distressed districts, the product stops being a hazard model and becomes a disclosure
workflow on top of licensed data — which is still a business, but a different one.

---

## Commercial model

| Block | Position |
|---|---|
| Customer segments | UAE banks and Islamic banks with corporate and commercial real-estate books; later insurers and regulators as a reference layer |
| Value proposition | CRFR2-grade, facility-level evidence at a fraction of a catastrophe model, with the audit trail attached |
| Channels | Direct to the CRO and model risk function; hackathon to pilot to annual subscription |
| Revenue | Annual subscription scaled to book size, plus per-assessment fees for stress-test cycles |
| Key activities | Hazard validation, disclosure generation, keeping pace with regulatory change |
| Key partners | Licensed hazard vendors (JBA, Climate X) as the upgrade path; municipal and land-department data |
| Cost structure | Model validation, data licensing, and a small engineering team — no hydraulic modelling staff |
| Competitive position | Sits *under* catastrophe models rather than competing with them: banks that cannot justify six figures a year can still produce defensible disclosure |

Built during the Dubai leg of UAE Hackathon 2026. The model is open to scrutiny: the
validation is reproducible from `pipeline/tune.py`, and the failure modes are documented on
purpose rather than hidden.
