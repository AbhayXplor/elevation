import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { MapCanvas, type MapFacility } from '@/components/MapCanvas'
import { portfolio } from '@/lib/portfolio'
import { useStore } from '@/lib/store'
import {
  aed,
  band,
  BAND_COLOR,
  customerHeat,
  DETERMINATION_COLOR,
  determine,
  download,
  money,
  num,
  pct,
} from '@/lib/format'
import { Kpi } from '@/components/Kpi'
import { Button } from '@/components/ui/button'
import { Label, Meter, Panel, PanelHeader, RiskPill } from '@/components/ui/primitives'
import { explain, fallbackExplanation, type Explanation } from '@/lib/explain'
import type { Customer, Scenario } from '@/lib/types'

const CLAUSES: { ref: string; title: string; body: string; pick: (c: Customer, s: 'now' | '2030' | '2050') => string }[] = [
  {
    ref: '4.7.2',
    title: 'Customer and portfolio level',
    body: 'Risk assessed at the level of the individual customer as well as in aggregate.',
    pick: (c, s) => `Exposure AED ${money(c.exposure)} · 1-in-100 loss AED ${money(c.scenarios[s].loss100)}`,
  },
  {
    ref: '4.7.4',
    title: "Customer's exposure to physical risk",
    body: 'The magnitude of the modelled physical hazard reaching this borrower’s assets.',
    pick: (c, s) => `Pluvial score ${c.scenarios[s].floodScore.toFixed(0)} · depth ${c.scenarios[s].worstDepth.toFixed(2)} m`,
  },
  {
    ref: '4.7.5',
    title: 'Transmission channels',
    body: 'How physical risk becomes financial risk: collateral devaluation and interruption of revenue.',
    pick: (c, s) => `Collateral devaluation ${pct(c.scenarios[s].haircut)} · LTV ${pct(c.ltv, 0)} → ${pct(c.scenarios[s].ltvAfter, 0)}`,
  },
  {
    ref: '4.7.11',
    title: 'Geographical risk concentrations',
    body: 'Physical-risk metrics and indicators for concentrations across assets and collateral held.',
    pick: (c) => {
      const n = new Set(c.facilities.map((f) => f.district)).size
      return `${c.facilities.length} site${c.facilities.length === 1 ? '' : 's'} across ${n} district${n === 1 ? '' : 's'}`
    },
  },
  {
    ref: '4.10.2',
    title: 'Liquidity-risk impact',
    body: 'Where higher collateral haircuts and simultaneous drawdowns can tighten the funding position.',
    pick: (c, s) => `Haircut ${pct(c.scenarios[s].haircut)} applied to AED ${money(c.collateralValue)} of collateral`,
  },
  {
    ref: '4.11.6',
    title: 'Scenario-analysis outcomes',
    body: 'Impact of each adverse scenario on provisions, capital and liquidity against the baseline.',
    pick: (c, s) => `EAL AED ${money(c.scenarios[s].aal)} · ${pct(c.scenarios[s].aal / c.annualMargin)} of annual margin`,
  },
]

export function CustomerDetail({ id }: { id: string }) {
  const { scenario, setSelectedCustomer } = useStore()
  const c = portfolio.customers.find((x) => x.id === id)

  const facilities = useMemo<MapFacility[]>(() => {
    if (!c) return []
    return c.facilities.map((f) => ({
      id: f.id,
      customerId: c.id,
      customerName: c.name,
      name: f.name,
      district: f.district,
      lon: f.lon,
      lat: f.lat,
      floodScore: f.scenarios[scenario].score,
      heatScore: f.heatScenarios[scenario] ?? f.heatScore,
      depth100M: f.scenarios[scenario].depth,
      heightM: f.heightM,
      ring: f.ring,
    }))
  }, [c, scenario])

  // Stable identity: a fresh array every render would re-centre the map.
  const centre = useMemo<[number, number] | null>(() => {
    if (!facilities.length) return null
    return [
      facilities.reduce((s, f) => s + f.lon, 0) / facilities.length,
      facilities.reduce((s, f) => s + f.lat, 0) / facilities.length,
    ]
  }, [facilities])

  if (!c) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-[12.5px] text-ink-2">That borrower is no longer in the book.</p>
        <button
          onClick={() => setSelectedCustomer(null)}
          className="text-[11.5px] text-accent transition-opacity hover:opacity-80"
        >
          Back to the register
        </button>
      </div>
    )
  }

  const sc = c.scenarios[scenario]
  const det = determine(c, scenario)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-4 py-4 sm:px-5">
        <button
          onClick={() => setSelectedCustomer(null)}
          className="mb-3 flex items-center gap-1.5 text-[11.5px] text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} /> Borrower register
        </button>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-ink sm:text-[21px]">
                {c.name}
              </h2>
              <span className="rounded border border-line-2 px-1.5 py-0.5 text-[10px] text-ink-3">
                {c.rating}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-ink-3">
              {c.sector} · {c.segment} · {c.facilities.length} facilities · {c.tenorYears}-year tenor
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-medium"
              style={{
                color: DETERMINATION_COLOR[det.state],
                borderColor: `${DETERMINATION_COLOR[det.state]}40`,
                background: `${DETERMINATION_COLOR[det.state]}12`,
              }}
            >
              CRFR2 · {det.state}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const record = {
                  product: 'Elevation — physical climate risk assessment',
                  generatedAt: new Date().toISOString(),
                  scenario: scenario === 'now' ? 'baseline' : scenario,
                  customer: {
                    id: c.id,
                    name: c.name,
                    rating: c.rating,
                    sector: c.sector,
                    occupancy: c.occupancy,
                    segment: c.segment,
                    tenorYears: c.tenorYears,
                    exposureAed: c.exposure,
                    collateralAed: c.collateralValue,
                    annualMarginAed: c.annualMargin,
                    ltv: c.ltv,
                  },
                  crfr2: { classification: det.state, rationale: det.reason },
                  metrics: {
                    loss1In100Aed: sc.loss100,
                    damage1In100ShareOfAsset: sc.damage100,
                    expectedAnnualLossAed: sc.aal,
                    worstDepthM: Number(sc.worstDepth.toFixed(3)),
                    pluvialScore: Number(sc.floodScore.toFixed(1)),
                    heatScore: Number(customerHeat(c, scenario).toFixed(1)),
                    collateralHaircut: sc.haircut,
                    ltvAfter: sc.ltvAfter,
                  },
                  facilities: c.facilities.map((f) => ({
                    id: f.id,
                    name: f.name,
                    district: f.district,
                    lon: f.lon,
                    lat: f.lat,
                    heightM: f.heightM,
                    assetValueAed: f.assetValue,
                    pluvialScore: Number(f.scenarios[scenario].score.toFixed(1)),
                    depth1In100M: Number(f.scenarios[scenario].depth.toFixed(3)),
                  })),
                  clauseMapping: CLAUSES.map((k) => ({
                    clause: k.ref,
                    title: k.title,
                    value: k.pick(c, scenario),
                  })),
                  provenance: {
                    terrain: 'Copernicus DEM GLO-30',
                    buildings: 'Overture Buildings',
                    climate: 'ERA5 (Open-Meteo) 2015–2024',
                    framework: 'CBUAE C 8/2025 · BCBS CRFR2',
                  },
                }
                download(
                  `elevation-${c.id}-${scenario}.json`,
                  JSON.stringify(record, null, 2),
                  'application/json',
                )
              }}
            >
              Export evidence
            </Button>
          </div>
        </div>

        <p className="mt-2 max-w-[720px] border-l-2 border-line-2 pl-3 text-[11.5px] leading-relaxed text-ink-3">
          {det.reason}. Figures reflect the <span className="text-ink-2">{scenario === 'now' ? 'baseline' : scenario}</span>{' '}
          scenario and are computed from the customer’s own facility coordinates, not a sector
          average.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Exposure"
            value={money(c.exposure)}
            unit="AED"
            sub={`${pct(c.ltv, 0)} LTV on AED ${money(c.collateralValue)} collateral`}
            bar={<Meter value={1} color="#7c9cff" height={3} />}
          />
          <Kpi
            label="1-in-100 loss"
            value={money(sc.loss100)}
            unit="AED"
            tone="danger"
            sub={`${pct(sc.damage100)} of the AED ${money(c.assetValue)} insured asset value`}
            bar={<Meter value={sc.damage100} max={0.3} color="#f04438" height={3} />}
          />
          <Kpi
            label="Collateral haircut"
            value={pct(sc.haircut, 1)}
            tone={sc.haircut > 0.15 ? 'danger' : 'warn'}
            sub={`LTV ${pct(c.ltv, 0)} → ${pct(sc.ltvAfter, 0)} after haircut`}
            bar={<Meter value={sc.haircut} max={0.3} color="#fbbf24" height={3} />}
          />
          <Kpi
            label="Expected annual loss"
            value={money(sc.aal)}
            unit="AED"
            sub={`${pct(sc.aal / c.annualMargin)} of AED ${money(c.annualMargin)} annual margin`}
            bar={<Meter value={sc.aal / c.annualMargin} max={0.2} color="#fb7185" height={3} />}
          />
        </div>

        <ExplainPanel c={c} scenario={scenario} />

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
          <Panel flush className="overflow-x-auto">
            <div className="px-4 pb-3 pt-4">
              <PanelHeader
                title="Facilities"
                hint="Each site is a real building footprint with its own modelled depth"
              />
            </div>
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-surface-2/50">
                  {['Site', 'Area', 'Height', 'Pluvial', 'Depth', 'Damage', 'Loss'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-[6px] text-[10px] font-medium uppercase tracking-[0.07em] text-ink-4 ${
                        i > 0 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.facilities.map((f) => {
                  const fs = f.scenarios[scenario]
                  return (
                    <tr key={f.id} className="border-t border-line/70">
                      <td className="px-4 py-2">
                        <div className="text-[11.5px] text-ink">{f.district}</div>
                        <div className="mono text-[9.5px] text-ink-4">
                          {f.lat.toFixed(4)}, {f.lon.toFixed(4)}
                        </div>
                      </td>
                      <td className="mono px-4 py-2 text-right text-[11px] text-ink-3">
                        {num(f.areaM2)}
                      </td>
                      <td className="mono px-4 py-2 text-right text-[11px] text-ink-3">
                        {f.heightM.toFixed(0)}m
                      </td>
                      <td className="px-4 py-2 text-right">
                        <RiskPill score={fs.score} />
                      </td>
                      <td className="mono px-4 py-2 text-right text-[11px] text-ink-2">
                        {fs.depth.toFixed(2)}m
                      </td>
                      <td className="mono px-4 py-2 text-right text-[11px] text-ink-2">
                        {pct(fs.damage)}
                      </td>
                      <td className="mono px-4 py-2 text-right text-[11px]" style={{ color: '#fb7185' }}>
                        {aed(fs.loss)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Panel>

          <Panel flush className="overflow-hidden">
            <div className="px-4 pb-2.5 pt-4">
              <PanelHeader title="Site locations" hint="Hazard layer at the selected scenario" />
            </div>
            <MapCanvas
              className="h-[236px] border-t border-line"
              facilities={facilities}
              overlay="flood"
              scenario={scenario}
              compact
              focus={centre}
              selectedCustomer={c.id}
            />
          </Panel>
        </div>

        <Panel flush className="mt-3">
          <div className="px-4 pb-3 pt-4">
            <PanelHeader
              title="Regulatory traceability"
              hint="How this borrower maps onto the CBUAE C 8/2025 clauses an examiner will ask about"
            />
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-line bg-line">
            {CLAUSES.map((cl) => (
              <div key={cl.ref} className="bg-surface px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="mono rounded border border-accent/25 bg-accent/10 px-1.5 py-px text-[9.5px] text-accent">
                    {cl.ref}
                  </span>
                  <span className="text-[11.5px] font-medium text-ink">{cl.title}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">{cl.body}</p>
                <p className="mono mt-1.5 text-[10.5px]" style={{ color: BAND_COLOR[band(sc.floodScore)] }}>
                  {cl.pick(c, scenario)}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
            <Label>Provenance</Label>
            <span className="text-[10.5px] text-ink-4">
              Hazard: internal terrain screen (30 m DEM, model v1.0) · Footprints: Overture ·
              Exposure: bank records — internal source, not vendor-supplied
            </span>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/**
 * Plain-English summary of this borrower. The deterministic text renders
 * immediately, so the panel is never empty; the model version replaces it when
 * the endpoint answers.
 */
function ExplainPanel({ c, scenario }: { c: Customer; scenario: Scenario }) {
  const [ex, setEx] = useState<Explanation>(() => ({
    text: fallbackExplanation(c, scenario),
    source: 'fallback',
  }))

  useEffect(() => {
    let alive = true
    setEx({ text: fallbackExplanation(c, scenario), source: 'fallback' })
    explain(c, scenario).then((e) => {
      if (alive) setEx(e)
    })
    return () => {
      alive = false
    }
  }, [c, scenario])

  return (
    <Panel className="mt-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <Label>Why this borrower is flagged</Label>
        </div>
        <span className="rounded border border-line-2 px-1.5 py-0.5 text-[9.5px] text-ink-4">
          {ex.source === 'model' ? 'Drafted by Gemini from the figures above' : 'Built from the figures above'}
        </span>
      </div>
      <p className="mt-2 max-w-[860px] text-[12px] leading-relaxed text-ink-2">{ex.text}</p>
    </Panel>
  )
}
