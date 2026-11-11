import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Hazard, Scenario, ViewId } from './types'

const VIEWS: ViewId[] = ['overview', 'map', 'portfolio', 'evidence', 'report']
const SCENARIOS: Scenario[] = ['now', '2030', '2050']

/** Views are linkable: ?view=portfolio&customer=xyz&scenario=2050 */
function readParams() {
  const p = new URLSearchParams(window.location.search)
  const view = p.get('view') as ViewId | null
  const scenario = p.get('scenario') as Scenario | null
  return {
    view: view && VIEWS.includes(view) ? view : ('overview' as ViewId),
    scenario: scenario && SCENARIOS.includes(scenario) ? scenario : ('now' as Scenario),
    customer: p.get('customer'),
  }
}

interface Store {
  view: ViewId
  setView: (v: ViewId) => void
  scenario: Scenario
  setScenario: (s: Scenario) => void
  hazard: Hazard
  setHazard: (h: Hazard) => void
  selectedCustomer: string | null
  setSelectedCustomer: (id: string | null) => void
  focusFacility: string | null
  setFocusFacility: (id: string | null) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readParams)
  const [view, setView] = useState<ViewId>(initial.view)
  const [scenario, setScenario] = useState<Scenario>(initial.scenario)
  const [hazard, setHazard] = useState<Hazard>('flood')
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(initial.customer)
  const [focusFacility, setFocusFacility] = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams()
    if (view !== 'overview') p.set('view', view)
    if (scenario !== 'now') p.set('scenario', scenario)
    if (selectedCustomer) p.set('customer', selectedCustomer)
    const query = p.toString()
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
  }, [view, scenario, selectedCustomer])

  const value = useMemo(
    () => ({
      view,
      setView,
      scenario,
      setScenario,
      hazard,
      setHazard,
      selectedCustomer,
      setSelectedCustomer,
      focusFacility,
      setFocusFacility,
    }),
    [view, scenario, hazard, selectedCustomer, focusFacility],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
