import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { MobileNav, Sidebar, TopBar } from '@/components/Shell'
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

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-[58px] lg:pb-0">
        <TopBar title={meta.title} subtitle={meta.subtitle} />
        {view === 'overview' && <Overview />}
        {view === 'map' && <MapView />}
        {view === 'portfolio' && <Portfolio />}
        {view === 'evidence' && <Evidence />}
        {view === 'report' && <Report />}
      </div>
      <MobileNav />
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
