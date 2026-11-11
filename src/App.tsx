import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { Compass } from 'lucide-react'
import { useState } from 'react'
import { MobileNav, Sidebar, TopBar } from '@/components/Shell'
import { TOUR_KEY, Tour } from '@/components/Tour'
import { StoreProvider, useStore } from '@/lib/store'
import { portfolio } from '@/lib/portfolio'
import { Overview } from '@/views/Overview'
import { MapView } from '@/views/MapView'
import { Portfolio } from '@/views/Portfolio'
import { Evidence } from '@/views/Evidence'
import { Report } from '@/views/Report'

const META: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: portfolio.institution },
  map: { title: 'Exposure map', subtitle: 'Dubai · pluvial & heat' },
  portfolio: { title: 'Borrowers', subtitle: 'Corporate & SME book' },
  evidence: { title: 'Model & evidence', subtitle: 'Method, sources, validation' },
  report: { title: 'CRFR2 disclosure', subtitle: 'CBUAE C 8/2025 · BCBS CRFR2' },
}

function Shell() {
  const { view } = useStore()
  const meta = META[view] ?? META.overview

  // Shown once per browser; a shared deep link into one borrower skips it.
  const [tour, setTour] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tour') === '1') return true
    if (params.get('tour') === '0' || params.get('customer')) return false
    return !window.localStorage.getItem(TOUR_KEY)
  })

  const closeTour = () => {
    setTour(false)
    try {
      window.localStorage.setItem(TOUR_KEY, '1')
    } catch {
      // Private mode: the tour simply shows again next time.
    }
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-[58px] lg:pb-0">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          right={
            <button
              onClick={() => setTour(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-ink"
            >
              <Compass size={13} />
              <span>Tour</span>
            </button>
          }
        />
        {view === 'overview' && <Overview />}
        {view === 'map' && <MapView />}
        {view === 'portfolio' && <Portfolio />}
        {view === 'evidence' && <Evidence />}
        {view === 'report' && <Report />}
      </div>
      <MobileNav />
      <Tour key={tour ? 'tour-open' : 'tour-closed'} open={tour} onClose={closeTour} />
    </div>
  )
}

export default function App() {
  return (
    <TooltipPrimitive.Provider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </TooltipPrimitive.Provider>
  )
}
