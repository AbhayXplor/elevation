import { ArrowRight, ChevronRight } from 'lucide-react'
import { portfolio } from '@/lib/portfolio'
import { useStore } from '@/lib/store'
import { useModel } from '@/lib/model'
import { aed, band, BAND_COLOR, DETERMINATION_COLOR, determine, money, pct, ramp } from '@/lib/format'
import { Kpi } from '@/components/Kpi'
import { Button } from '@/components/ui/button'
import { DotStrip, Label, Meter, Panel, PanelHeader, RiskPill } from '@/components/ui/primitives'
import type { Scenario } from '@/lib/types'

const SCEN_LABEL: Record<Scenario, string> = { now: 'Baseline', '2030': '2030', '2050': '2050' }

export function Overview() {
  const { scenario, setScenario, setView, setSelectedCustomer } = useStore()
  const { model } = useModel()
  const t = portfolio.totals
  const s = t[scenario]
  const base = t.now

  const ranked = [...portfolio.customers].sort(
    (a, b) => b.scenarios[scenario].haircut - a.scenarios[scenario].haircut,
  )
  const priority = ranked.slice(0, 6)

  const districts = portfolio.byDistrict.slice(0, 8)
  const maxDistrict = Math.max(...districts.map((d) => d.assetValue))

  const dets = portfolio.customers.map((c) => determine(c, scenario).state)
  const detCount = {
    Subject: dets.filter((d) => d === 'Subject').length,
    'Not subject': dets.filter((d) => d === 'Not subject').length,
    'Cannot determine': dets.filter((d) => d === 'Cannot determine').length,
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1180px] space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        {/* header */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-ink">
              Climate exposure across the corporate book
            </h2>
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-ink-3">
              Every borrower mapped to its actual collateral, scored against a 1-in-100-year pluvial
              event and a 2050 heat projection. Figures move with the scenario selector.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setView('map')}>
            Open exposure map
            <ArrowRight size={13} strokeWidth={2} />
          </Button>
        </div>

        {/* KPIs */}
        <div data-tour="overview-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Assessed exposure"
            value={money(t.exposure)}
            unit="AED"
            sub={`${t.customers} borrowers · ${t.facilities} geocoded facilities`}
            bar={<Meter value={1} color="#7c9cff" height={3} />}
          />
          <Kpi
            label="1-in-100 loss"
            value={money(s.loss100)}
            unit="AED"
            tone="danger"
            sub={`${pct(s.loss100PctAsset)} of AED ${money(t.assetValue)} modelled asset value`}
            bar={<Meter value={s.loss100PctAsset} max={0.25} color="#f04438" height={3} />}
          />
          <Kpi
            label="Expected annual loss"
            value={money(s.aal)}
            unit="AED"
            sub={`${pct(s.aalRatio, 3)} of exposure · ${pct(s.aalVsMargin)} of annual margin`}
            bar={<Meter value={s.aalVsMargin} max={0.15} color="#fbbf24" height={3} />}
          />
          <Kpi
            label="LTV breaches"
            value={s.ltvBreach}
            unit={`of ${t.customers}`}
            tone={s.ltvBreach > 0 ? 'danger' : 'default'}
            sub={`${s.newBreach} pushed above 90% by this event`}
            bar={<Meter value={s.ltvBreach} max={t.customers} color="#fb7185" height={3} />}
          />
        </div>

        {/* middle row */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.45fr_1fr]">
          <Panel flush className="p-4">
            <PanelHeader
              title="Secured value by district"
              hint="Where the collateral physically sits, and how the terrain screens that district"
            />
            <div className="mt-4 space-y-[9px]">
              {districts.map((d) => (
                <div key={d.district} className="group flex items-center gap-3">
                  <div className="w-[132px] shrink-0 truncate text-[11.5px] text-ink-2">
                    {d.district}
                  </div>
                  <div className="relative h-[15px] flex-1 overflow-hidden rounded-[3px] bg-white/[0.035]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-[3px] transition-all duration-500"
                      style={{
                        width: `${(d.assetValue / maxDistrict) * 100}%`,
                        background: `linear-gradient(90deg, ${BAND_COLOR[band(d.floodScore)]}22, ${BAND_COLOR[band(d.floodScore)]}55)`,
                        borderRight: `1.5px solid ${BAND_COLOR[band(d.floodScore)]}`,
                      }}
                    />
                  </div>
                  <div className="mono w-[52px] shrink-0 text-right text-[11px] text-ink-2">
                    {money(d.assetValue)}
                  </div>
                  <RiskPill score={d.floodScore} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[10.5px] text-ink-4">
                Bar length = secured asset value · colour = mean pluvial score
              </span>
              <button
                onClick={() => setView('map')}
                className="flex items-center gap-1 text-[11px] font-medium text-accent transition-opacity hover:opacity-80"
              >
                View on map <ChevronRight size={12} />
              </button>
            </div>
          </Panel>

          <div className="space-y-3">
            <Panel flush className="p-4">
              <PanelHeader
                title="Forward trajectory"
                hint="1-in-100 event loss as the hazard deepens"
              />
              <div className="mt-3.5 space-y-2.5">
                {(['now', '2030', '2050'] as Scenario[]).map((k) => {
                  const sc = t[k]
                  const active = k === scenario
                  const w = sc.loss100 / t['2050'].loss100
                  return (
                    <button
                      key={k}
                      onClick={() => setScenario(k)}
                      className={`flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors ${
                        active ? 'bg-white/[0.045]' : 'hover:bg-white/[0.025]'
                      }`}
                    >
                      <span
                        className={`w-[54px] shrink-0 text-[11px] font-medium ${
                          active ? 'text-ink' : 'text-ink-3'
                        }`}
                      >
                        {SCEN_LABEL[k]}
                      </span>
                      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${w * 100}%`, background: ramp(40 + w * 55) }}
                        />
                      </div>
                      <span className="mono w-[54px] shrink-0 text-right text-[11.5px] text-ink">
                        {money(sc.loss100)}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-[11px] text-ink-3">2050 vs baseline</span>
                <span className="mono text-[12.5px] text-risk-high">
                  +{(((t['2050'].loss100 - base.loss100) / base.loss100) * 100).toFixed(0)}%
                </span>
              </div>
            </Panel>

            <Panel flush className="p-4">
              <PanelHeader title="CRFR2 determination" hint="Required disclosure classification" />
              <div className="mt-3 space-y-2">
                {(
                  [
                    ['Subject', DETERMINATION_COLOR.Subject],
                    ['Cannot determine', DETERMINATION_COLOR['Cannot determine']],
                    ['Not subject', DETERMINATION_COLOR['Not subject']],
                  ] as [keyof typeof detCount, string][]
                ).map(([k, color]) => (
                  <div key={k} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                    <span className="flex-1 text-[11.5px] text-ink-2">{k}</span>
                    <span className="mono text-[11.5px] text-ink">{detCount[k]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-line pt-2.5">
                <div className="flex h-[6px] overflow-hidden rounded-full">
                  <div
                    style={{
                      width: `${(detCount.Subject / t.customers) * 100}%`,
                      background: '#f04438',
                    }}
                  />
                  <div
                    style={{
                      width: `${(detCount['Cannot determine'] / t.customers) * 100}%`,
                      background: '#fbbf24',
                    }}
                  />
                  <div
                    style={{
                      width: `${(detCount['Not subject'] / t.customers) * 100}%`,
                      background: '#34d399',
                    }}
                  />
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* priority accounts */}
        <Panel flush className="overflow-x-auto">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <PanelHeader
              title="Priority accounts"
              hint="Ranked by collateral impairment under the selected scenario"
            />
            <Button variant="ghost" size="sm" onClick={() => setView('portfolio')}>
              All {t.customers} borrowers <ChevronRight size={12} />
            </Button>
          </div>
          <div className="border-t border-line">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left">
                  {['Borrower', 'Sector', 'Exposure', 'Pluvial', 'Depth', 'LTV', 'Haircut', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-[7px] text-[10px] font-medium uppercase tracking-[0.07em] text-ink-4"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {priority.map((c) => {
                  const sc = c.scenarios[scenario]
                  const d = determine(c, scenario)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c.id)
                        setView('portfolio')
                      }}
                      className="group cursor-pointer border-t border-line/70 transition-colors hover:bg-white/[0.025]"
                    >
                      <td className="px-4 py-[9px]">
                        <div className="text-[12px] font-medium text-ink">{c.name}</div>
                        <div className="text-[10.5px] text-ink-4">
                          {c.segment} · {c.rating}
                        </div>
                      </td>
                      <td className="px-4 py-[9px] text-[11.5px] text-ink-3">{c.sector}</td>
                      <td className="mono px-4 py-[9px] text-[11.5px] text-ink-2">
                        {aed(c.exposure)}
                      </td>
                      <td className="px-4 py-[9px]">
                        <RiskPill score={sc.floodScore} />
                      </td>
                      <td className="mono px-4 py-[9px] text-[11.5px] text-ink-2">
                        {sc.worstDepth.toFixed(2)}m
                      </td>
                      <td className="px-4 py-[9px]">
                        <div className="flex items-center gap-2">
                          <span className="mono text-[11px] text-ink-4">
                            {(c.ltv * 100).toFixed(0)}
                          </span>
                          <ArrowRight size={10} className="text-ink-4" />
                          <span
                            className="mono text-[11.5px]"
                            style={{
                              color: sc.ltvAfter > 0.9 ? '#f04438' : '#a7aeb9',
                            }}
                          >
                            {(sc.ltvAfter * 100).toFixed(0)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-[9px]">
                        <div className="flex items-center gap-2">
                          <div className="w-[46px]">
                            <Meter
                              value={sc.haircut}
                              max={0.3}
                              color={sc.haircut > 0.15 ? '#f04438' : '#fbbf24'}
                              height={3}
                            />
                          </div>
                          <span className="mono text-[11px] text-ink-3">
                            {pct(sc.haircut, 0)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-[9px] text-right">
                        <span
                          className="text-[10.5px]"
                          style={{ color: DETERMINATION_COLOR[d.state] }}
                        >
                          {d.state}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* footer strip */}
        <div className="flex items-center gap-6 rounded-[10px] border border-line bg-surface/60 px-4 py-3">
          <Label>Model</Label>
          <span className="text-[11.5px] text-ink-3">
            30 m Copernicus DEM · {portfolio.totals.facilities} real footprints · ERA5 heat
          </span>
          <span className="ml-auto flex items-center gap-2 text-[11px] text-ink-4">
            Validated against {model?.validation.n_sites ?? 20} districts flooded in April 2024
            {model && (
              <DotStrip values={model.validation.sites.map((x) => x.flood)} height={12} />
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
