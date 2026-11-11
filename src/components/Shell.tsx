import {
  Building2,
  FileSpreadsheet,
  FlaskConical,
  LayoutDashboard,
  Map as MapIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { Segmented } from './ui/primitives'
import type { Scenario, ViewId } from '@/lib/types'

const NAV: { id: ViewId; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, hint: 'Portfolio position' },
  { id: 'map', label: 'Exposure map', icon: MapIcon, hint: 'Hazard & assets' },
  { id: 'portfolio', label: 'Borrowers', icon: Building2, hint: 'Customer register' },
  { id: 'evidence', label: 'Model & evidence', icon: FlaskConical, hint: 'Method, validation' },
  { id: 'report', label: 'CRFR2 disclosure', icon: FileSpreadsheet, hint: 'Regulatory export' },
]

export function Sidebar() {
  const { view, setView, setSelectedCustomer } = useStore()

  return (
    <aside className="hidden w-[222px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-[18px]">
        <img src="/mark.svg" alt="" className="h-7 w-7" />
        <div className="leading-none">
          <div className="text-[14px] font-semibold tracking-[-0.02em] text-ink">Elevation</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-4">
            Physical risk
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-px px-2">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => {
                // Navigating from the sidebar returns to the list, not the last
                // borrower that happened to be open.
                setSelectedCustomer(null)
                setView(item.id)
              }}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left transition-colors duration-150',
                active ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-white/[0.035] hover:text-ink',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent" />
              )}
              <Icon
                size={14.5}
                strokeWidth={1.9}
                className={cn('shrink-0', active ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2')}
              />
              <span className="text-[12.5px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto space-y-2 p-3">
        <div className="rounded-lg border border-line bg-canvas/60 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-low" />
            <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">
              Framework
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-2">
            CBUAE <span className="mono text-ink">C 8/2025</span> · BCBS{' '}
            <span className="mono text-ink">CRFR2</span>
          </p>
        </div>
        <p className="px-1 text-[10px] leading-relaxed text-ink-4">
          Real hazard data: Copernicus · Overture · ERA5
          <br />
          Synthetic book, calibrated to a UAE mid-market lender
        </p>
      </div>
    </aside>
  )
}

const SHORT: Record<ViewId, string> = {
  overview: 'Overview',
  map: 'Map',
  portfolio: 'Borrowers',
  evidence: 'Evidence',
  report: 'CRFR2',
}

/** Bottom tab bar, the only navigation below `lg` where the sidebar is hidden. */
export function MobileNav() {
  const { view, setView, setSelectedCustomer } = useStore()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map((item) => {
        const Icon = item.icon
        const active = view === item.id
        return (
          <button
            key={item.id}
            onClick={() => {
              setSelectedCustomer(null)
              setView(item.id)
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 pb-1.5 pt-2 transition-colors',
              active ? 'text-accent' : 'text-ink-3',
            )}
          >
            <Icon size={18} strokeWidth={active ? 2.1 : 1.8} />
            <span className="text-[9.5px] font-medium leading-none">{SHORT[item.id]}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { scenario, setScenario } = useStore()

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:px-5">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="truncate text-[13.5px] font-semibold tracking-[-0.015em] text-ink">
          {title}
        </h1>
        {subtitle && <span className="hidden truncate text-[11.5px] text-ink-3 sm:inline">{subtitle}</span>}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {right}
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.09em] text-ink-4 sm:inline">
            Scenario
          </span>
          <Segmented<Scenario>
            value={scenario}
            onChange={setScenario}
            size="sm"
            options={[
              { value: 'now', label: 'Baseline' },
              { value: '2030', label: '2030' },
              { value: '2050', label: '2050' },
            ]}
          />
        </div>
      </div>
    </header>
  )
}
