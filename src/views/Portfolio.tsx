import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { portfolio } from '@/lib/portfolio'
import { useStore } from '@/lib/store'
import { aed, determine, money, pct } from '@/lib/format'
import { Label, Meter, Panel, RiskPill, Segmented } from '@/components/ui/primitives'
import { CustomerDetail } from './CustomerDetail'
import type { Scenario } from '@/lib/types'

type SortKey = 'name' | 'exposure' | 'score' | 'haircut' | 'ltvAfter'
type Seg = 'all' | 'Corporate' | 'SME'

export function Portfolio() {
  const { scenario, selectedCustomer } = useStore()

  if (selectedCustomer) return <CustomerDetail id={selectedCustomer} />

  return <Register scenario={scenario} />
}

function Register({ scenario }: { scenario: Scenario }) {
  const { setSelectedCustomer } = useStore()
  const [q, setQ] = useState('')
  const [seg, setSeg] = useState<Seg>('all')
  const [sort, setSort] = useState<SortKey>('haircut')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = portfolio.customers.filter((c) => {
      if (seg !== 'all' && c.segment !== seg) return false
      if (!needle) return true
      return (
        c.name.toLowerCase().includes(needle) ||
        c.sector.toLowerCase().includes(needle) ||
        c.facilities.some((f) => f.district.toLowerCase().includes(needle))
      )
    })
    const cmp: Record<SortKey, (a: (typeof filtered)[number], b: (typeof filtered)[number]) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      exposure: (a, b) => b.exposure - a.exposure,
      score: (a, b) => b.scenarios[scenario].floodScore - a.scenarios[scenario].floodScore,
      ltvAfter: (a, b) => b.scenarios[scenario].ltvAfter - a.scenarios[scenario].ltvAfter,
      haircut: (a, b) => b.scenarios[scenario].haircut - a.scenarios[scenario].haircut,
    }
    return [...filtered].sort(cmp[sort])
  }, [q, seg, sort, scenario])

  const head: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'name', label: 'Borrower' },
    { key: 'exposure', label: 'Exposure', align: 'right' },
    { key: 'score', label: 'Pluvial', align: 'right' },
    { key: 'ltvAfter', label: 'LTV → post-event', align: 'right' },
    { key: 'haircut', label: 'Haircut', align: 'right' },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1180px] space-y-4 px-5 py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-ink">
              Borrower register
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {rows.length} of {portfolio.totals.customers} borrowers · each secured on geocoded
              facilities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4"
                strokeWidth={2}
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search borrower, sector or district"
                className="h-8 w-[248px] rounded-md border border-line-2 bg-surface-2 pl-8 pr-3 text-[12px] text-ink placeholder:text-ink-4 outline-none transition-colors focus:border-accent/45"
              />
            </div>
            <Segmented<Seg>
              value={seg}
              onChange={setSeg}
              size="sm"
              options={[
                { value: 'all', label: 'All' },
                { value: 'Corporate', label: 'Corporate' },
                { value: 'SME', label: 'SME' },
              ]}
            />
          </div>
        </div>

        <Panel flush className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-2/60">
                {head.map((h) => (
                  <th
                    key={h.key}
                    onClick={() => setSort(h.key)}
                    className={`cursor-pointer px-4 py-2 text-[10px] font-medium uppercase tracking-[0.07em] transition-colors hover:text-ink-2 ${
                      h.align === 'right' ? 'text-right' : 'text-left'
                    } ${sort === h.key ? 'text-ink-2' : 'text-ink-4'}`}
                  >
                    {h.label}
                    {sort === h.key && (
                      <span className="ml-1 text-accent">{h.key === 'name' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-[0.07em] text-ink-4">
                  Sites
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.07em] text-ink-4">
                  CRFR2
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const sc = c.scenarios[scenario]
                const d = determine(c, scenario)
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomer(c.id)}
                    className="cursor-pointer border-t border-line/70 transition-colors hover:bg-white/[0.028]"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-medium text-ink">{c.name}</span>
                        <span className="rounded border border-line-2 px-1 py-px text-[9.5px] text-ink-4">
                          {c.rating}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-ink-4">
                        {c.sector} · {c.segment}
                      </div>
                    </td>
                    <td className="mono px-4 py-2.5 text-right text-[12px] text-ink-2">
                      {aed(c.exposure)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RiskPill score={sc.floodScore} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="mono text-[11px] text-ink-4">
                          {(c.ltv * 100).toFixed(0)}%
                        </span>
                        <ArrowRight size={10} className="text-ink-4" />
                        <span
                          className="mono text-[12px]"
                          style={{ color: sc.ltvAfter > 0.9 ? '#f04438' : '#eceef1' }}
                        >
                          {(sc.ltvAfter * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-[52px]">
                          <Meter
                            value={sc.haircut}
                            max={0.3}
                            color={sc.haircut > 0.15 ? '#f04438' : '#fbbf24'}
                            height={3}
                          />
                        </div>
                        <span className="mono w-[36px] text-right text-[11.5px] text-ink-2">
                          {pct(sc.haircut, 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-3">
                      {c.facilities.length} · {c.facilities[0]?.district.split(' ')[0]}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className="text-[10.5px]"
                        style={{
                          color:
                            d.state === 'Subject'
                              ? '#f04438'
                              : d.state === 'Not subject'
                                ? '#34d399'
                                : '#fbbf24',
                        }}
                      >
                        {d.state}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex items-center gap-6 border-t border-line bg-surface-2/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Label>Total exposure</Label>
              <span className="mono text-[12px] text-ink">
                AED {money(rows.reduce((s, c) => s + c.exposure, 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label>1-in-100 loss</Label>
              <span className="mono text-[12px]" style={{ color: '#fb7185' }}>
                AED {money(rows.reduce((s, c) => s + c.scenarios[scenario].loss100, 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label>Breaches</Label>
              <span className="mono text-[12px] text-ink">
                {rows.filter((c) => c.scenarios[scenario].ltvAfter > 0.9).length}
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
