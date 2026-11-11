import { Download, FileJson } from 'lucide-react'
import { portfolio } from '@/lib/portfolio'
import { useStore } from '@/lib/store'
import { aed, customerHeat, DETERMINATION_COLOR, determine, download, money, pct, toCsv } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Label, Meter, Panel, PanelHeader } from '@/components/ui/primitives'

const STATE_COLOR = DETERMINATION_COLOR

const RUN_DATE = new Date().toISOString().slice(0, 10)

export function Report() {
  const { scenario } = useStore()
  const rows = portfolio.customers.map((c) => ({ c, d: determine(c, scenario) }))

  const counts = {
    Subject: rows.filter((r) => r.d.state === 'Subject'),
    'Cannot determine': rows.filter((r) => r.d.state === 'Cannot determine'),
    'Not subject': rows.filter((r) => r.d.state === 'Not subject'),
  }

  const exportCsv = () => {
    const head = [
      'Borrower',
      'Exposure AED',
      'Segment',
      'Rating',
      'Determination',
      'Basis',
      'Pluvial score',
      'Depth m',
      'Haircut',
      'LTV after',
      'Source',
      'Data gap',
    ]
    const body = rows.map(({ c, d }) => {
      const sc = c.scenarios[scenario]
      return [
        c.name,
        c.exposure,
        c.segment,
        c.rating,
        d.state,
        d.reason,
        sc.floodScore,
        sc.worstDepth,
        (sc.haircut * 100).toFixed(1),
        (sc.ltvAfter * 100).toFixed(1),
        'Modelled (internal)',
        d.state === 'Cannot determine' ? d.reason : 'None',
      ]
    })
    download(`elevation-crfr2-${scenario}-${RUN_DATE}.csv`, toCsv([head, ...body]))
  }

  const exportJson = () => {
    download(
      `elevation-audit-${scenario}-${RUN_DATE}.json`,
      JSON.stringify(
        {
          institution: portfolio.institution,
          asOf: portfolio.asOf,
          scenario,
          framework: ['CBUAE C 8/2025', 'BCBS CRFR2'],
          totals: portfolio.totals[scenario],
          exposures: rows.map(({ c, d }) => ({
            borrower: c.name,
            exposure: c.exposure,
            determination: d.state,
            basis: d.reason,
            hazards: { pluvial: c.scenarios[scenario].floodScore, heat: customerHeat(c, scenario) },
            financial: {
              loss100: c.scenarios[scenario].loss100,
              haircut: c.scenarios[scenario].haircut,
              ltvAfter: c.scenarios[scenario].ltvAfter,
            },
            facilities: c.facilities.map((f) => ({
              id: f.id,
              lat: f.lat,
              lon: f.lon,
              areaM2: f.areaM2,
              depth: f.scenarios[scenario].depth,
              loss: f.scenarios[scenario].loss,
            })),
          })),
        },
        null,
        2,
      ),
      'application/json',
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1180px] space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-ink">
              CRFR2 disclosure
            </h2>
            <p className="mt-1 max-w-[660px] text-[12.5px] leading-relaxed text-ink-3">
              Template CRFR2 of the BCBS voluntary disclosure framework separates exposures that are
              subject to physical risk from those that are not, and records the basis for each. Where
              the evidence is genuinely missing we report{' '}
              <span style={{ color: DETERMINATION_COLOR['Cannot determine'] }}>cannot determine</span>{' '}
              rather than force a binary. This is that table.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportJson}>
              <FileJson size={13} /> Audit JSON
            </Button>
            <Button variant="primary" onClick={exportCsv}>
              <Download size={13} /> Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['Subject', 'Cannot determine', 'Not subject'] as const).map((k) => {
            const list = counts[k]
            const exp = list.reduce((s, r) => s + r.c.exposure, 0)
            return (
              <Panel key={k} className="p-4">
                <div className="flex items-center justify-between">
                  <Label>{k}</Label>
                  <span
                    className="mono rounded px-1.5 py-px text-[10px]"
                    style={{ color: STATE_COLOR[k], background: `${STATE_COLOR[k]}14` }}
                  >
                    {list.length}
                  </span>
                </div>
                <div className="mono mt-2.5 text-[20px] leading-none text-ink">
                  {money(exp)}
                  <span className="ml-1 text-[10px] text-ink-4">AED</span>
                </div>
                <div className="mt-2.5">
                  <Meter
                    value={exp}
                    max={portfolio.totals.exposure}
                    color={STATE_COLOR[k]}
                    height={4}
                  />
                </div>
                <p className="mt-2 text-[10.5px] text-ink-3">
                  {pct(exp / portfolio.totals.exposure, 0)} of assessed exposure
                </p>
              </Panel>
            )
          })}
        </div>

        <Panel flush className="overflow-x-auto">
          <div className="px-4 pb-3 pt-4">
            <PanelHeader
              title="Exposure determination"
              hint={`Scenario: ${scenario === 'now' ? 'baseline' : scenario} · as of ${portfolio.asOf}`}
              right={
                <span className="text-[10.5px] text-ink-4">
                  source: <span className="text-ink-2">modelled (internal)</span>
                </span>
              }
            />
          </div>
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-surface-2/60">
                {['Borrower', 'Exposure', 'Determination', 'Basis', 'Pluvial', 'Haircut', 'Source'].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-ink-4 ${
                        i === 0 || i === 3 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, d }) => {
                const sc = c.scenarios[scenario]
                return (
                  <tr key={c.id} className="border-t border-line/70">
                    <td className="px-4 py-2 text-[11.5px] text-ink">{c.name}</td>
                    <td className="mono px-4 py-2 text-right text-[11px] text-ink-2">
                      {aed(c.exposure)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className="rounded px-1.5 py-px text-[10px]"
                        style={{ color: STATE_COLOR[d.state], background: `${STATE_COLOR[d.state]}12` }}
                      >
                        {d.state}
                      </span>
                    </td>
                    <td className="max-w-[300px] px-4 py-2 text-[10.5px] leading-snug text-ink-3">
                      {d.reason}
                    </td>
                    <td className="mono px-4 py-2 text-right text-[11px] text-ink-2">
                      {sc.floodScore.toFixed(0)}
                    </td>
                    <td className="mono px-4 py-2 text-right text-[11px] text-ink-2">
                      {pct(sc.haircut, 1)}
                    </td>
                    <td className="px-4 py-2 text-right text-[10px] text-ink-4">Internal</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Panel>
            <PanelHeader title="Methodology statement" hint="For the annual assessment file" />
            <div className="mt-3 space-y-2.5 text-[11px] leading-relaxed text-ink-3">
              <p>
                Physical climate risk is assessed at customer and portfolio level in line with
                CBUAE <span className="mono text-ink-2">C 8/2025 §4.7.2</span> and{' '}
                <span className="mono text-ink-2">§4.7.4</span>. Each exposure is geolocated to the
                collateral asset, scored against a 1-in-100-year pluvial surface and a projected
                heat index, and translated into an expected annual loss.
              </p>
              <p>
                Collateral values are adjusted by a haircut equal to the impairment expected in the
                1-in-100-year event, capped at 30%. That devaluation is reported as a transmission
                channel from physical to financial risk under{' '}
                <span className="mono text-ink-2">§4.7.5</span>, and its funding-side effect —
                higher haircuts in a less liquid market — under{' '}
                <span className="mono text-ink-2">§4.10.2</span>. Post-haircut LTV feeds the
                provisioning and capital assessment under{' '}
                <span className="mono text-ink-2">§4.11.6</span> alongside the ICAAP/ORSA narrative.
              </p>
              <p>
                Where facility-level evidence is missing or the modelled depth lands in the
                inconclusive band, the exposure is reported as{' '}
                <span style={{ color: '#fbbf24' }}>cannot determine</span> rather than forced into a
                binary. That is a deliberate disclosure choice, not a modelling failure.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Controls & traceability" hint="What an independent reviewer can check" />
            <div className="mt-3 space-y-2">
              {[
                ['Facilities geocoded', `${portfolio.totals.facilities} of ${portfolio.totals.facilities}`],
                ['Hazard resolution', '30 m DEM, 17.3 m screen grid'],
                ['Validation set', '20 districts, April 2024 event'],
                ['Model version', 'elevation-hazard v1.0'],
                ['Data provenance', 'Copernicus · Overture · ERA5 · Hazus'],
                ['Last assessment', portfolio.asOf],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between border-b border-line/60 pb-1.5">
                  <span className="text-[11px] text-ink-3">{k}</span>
                  <span className="mono text-[11px] text-ink-2">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md border border-line bg-canvas/50 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-risk-mod" />
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Known gap
                </span>
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-ink-3">
                Business-interruption losses are not yet modelled. Only physical damage to the
                collateral is captured.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
