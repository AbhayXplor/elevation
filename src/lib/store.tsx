import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Hazard, Scenario, ViewId } from './types'

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
  const [view, setView] = useState<ViewId>('overview')
  const [scenario, setScenario] = useState<Scenario>('now')
  const [hazard, setHazard] = useState<Hazard>('flood')
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [focusFacility, setFocusFacility] = useState<string | null>(null)

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
