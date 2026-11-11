import { useMemo, useState } from 'react'
import { MapCanvas, type MapFacility } from '@/components/MapCanvas'
import { portfolio } from '@/lib/portfolio'
import { useStore } from '@/lib/store'
import { band, BAND_COLOR, BAND_LABEL, money, pct, ramp } from '@/lib/format'
import { Label, Panel, Segmented } from '@/components/ui/primitives'
import type { Hazard } from '@/lib/types'
import { ChevronRight } from 'lucide-react'

export function MapView() {
  const { scenario, hazard, setHazard, setSelectedCustomer, setView, selectedCustomer } = useStore()
  const [focus, setFocus] = useState<[number, number] | null>(null)

  const facilities = useMemo<MapFacility[]>(
    () =>
      portfolio.customers.flatMap((c) =>
        c.facilities.map((f) => ({
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
        })),
      ),
    [scenario],
  )

  const ranked = useMemo(() => {
    const key = hazard === 'heat' ? 'heatScore' : 'floodScore'
    return [...facilities].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 9)
  }, [facilities, hazard])

  const avg = facilities.reduce((s, f) => s + (hazard === 'heat' ? f.heatScore : f.floodScore), 0) / facilities.length
  const atRisk = facilities.filter((f) => (hazard === 'heat' ? f.heatScore : f.floodScore) >= 55).length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      {/* toolbar */}
      <div className="flex min-h-[48px] shrink-0 items-center gap-4 border-b border-line bg-surface px-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Label>Layer</Label>
          <Segmented<Hazard>
            value={hazard}
            onChange={setHazard}
            size="sm"
            options={[
              { value: 'flood', label: 'Pluvial flood' },
              { value: 'heat', label: 'Heat' },
              { value: 'none', label: 'Basemap' },
            ]}
          />
        </div>

        <div className="hidden h-4 w-px bg-line lg:block" />

        <div className="hidden items-center gap-2.5 lg:flex">
          <Label>Scale</Label>
          <div className="relative h-[7px] w-[130px] overflow-hidden rounded-full">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, ${[0, 20, 35, 50, 65, 80, 100]
                  .map((v) => ramp(v))
                  .join(', ')})`,
              }}
            />
          </div>
          <div className="flex gap-2 text-[9.5px] text-ink-4">
            <span>low</span>
            <span className="text-ink-3">moderate</span>
            <span>severe</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4 text-[11px]">
          <span className="hidden text-ink-3 sm:inline">
            Facilities <span className="mono text-ink">{facilities.length}</span>
          </span>
          <span className="text-ink-3">
            Mean score <span className="mono text-ink">{avg.toFixed(0)}</span>
          </span>
          <span className="text-ink-3">
            Above 55 <span className="mono" style={{ color: '#fb7185' }}>{atRisk}</span>
          </span>
        </div>
      </div>

      {/* map — a fixed band on phones, the whole panel from `lg` up */}
      <div className="relative flex flex-1 flex-col lg:block lg:overflow-hidden">
        <div className="relative h-[44vh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
          <MapCanvas
            className="absolute inset-0"
            facilities={facilities}
            overlay={hazard}
            scenario={scenario}
            focus={focus}
            selectedCustomer={selectedCustomer}
            onPickCustomer={(id) => {
              setSelectedCustomer(id)
              setView('portfolio')
            }}
          />
        </div>

        <div className="mx-3 mb-3 mt-3 overflow-hidden rounded-[10px] border border-line-2 bg-surface lg:absolute lg:right-3 lg:top-3 lg:m-0 lg:w-[286px] lg:bg-canvas/92 lg:backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <span className="text-[11.5px] font-medium text-ink">Highest {hazard === 'heat' ? 'heat' : 'pluvial'} exposure</span>
            <span className="text-[10px] text-ink-4">of {facilities.length}</span>
          </div>
          <div className="overflow-y-auto lg:max-h-[calc(100vh-260px)]">
            {ranked.map((f) => {
              const score = hazard === 'heat' ? f.heatScore : f.floodScore
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setFocus([f.lon, f.lat])
                    setSelectedCustomer(f.customerId)
                  }}
                  className="flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2 text-left transition-colors last:border-0 hover:bg-white/[0.035]"
                >
                  <span
                    className="h-6 w-[2px] shrink-0 rounded-full"
                    style={{ background: BAND_COLOR[band(score)] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium text-ink">
                      {f.customerName}
                    </span>
                    <span className="block truncate text-[10px] text-ink-4">{f.district}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="mono block text-[11.5px]" style={{ color: BAND_COLOR[band(score)] }}>
                      {score.toFixed(0)}
                    </span>
                    <span className="mono block text-[9.5px] text-ink-4">
                      {BAND_LABEL[band(score)]}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setView('portfolio')}
            className="flex w-full items-center justify-center gap-1 border-t border-line py-2 text-[11px] font-medium text-accent transition-opacity hover:opacity-80"
          >
            Open borrower register <ChevronRight size={12} />
          </button>
        </div>

        {/* portfolio summary chip */}
        <Panel className="mx-3 mb-3 bg-surface p-3 lg:absolute lg:bottom-3 lg:left-3 lg:m-0 lg:w-[248px] lg:bg-canvas/92 lg:backdrop-blur-md">
          <Label>Book at a glance</Label>
          <div className="mt-2 space-y-1.5">
            <Line k="Exposure" v={`AED ${money(portfolio.totals.exposure)}`} />
            <Line k="Secured value" v={`AED ${money(portfolio.totals.collateral)}`} />
            <Line
              k="1-in-100 loss"
              v={`AED ${money(portfolio.totals[scenario].loss100)}`}
              color="#fb7185"
            />
            <Line
              k="Weighted haircut"
              v={pct(portfolio.totals[scenario].haircutWeighted)}
              color="#fbbf24"
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Line({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-ink-3">{k}</span>
      <span className="mono text-[11.5px]" style={{ color: color ?? '#eceef1' }}>
        {v}
      </span>
    </div>
  )
}
