export type Scenario = 'now' | '2030' | '2050'
export type Hazard = 'flood' | 'heat' | 'none'
export type ViewId = 'overview' | 'map' | 'portfolio' | 'evidence' | 'report'

export interface ScenarioFacility {
  score: number
  depth: number
  damage: number
  loss: number
  eal: number
}

export interface Facility {
  id: string
  name: string
  district: string
  lon: number
  lat: number
  areaM2: number
  heightM: number
  assetValue: number
  floodScore: number
  heatScore: number
  heatScenarios: Record<Scenario, number>
  ring: [number, number][]
  scenarios: Record<Scenario, ScenarioFacility>
}

export interface ScenarioCustomer {
  aal: number
  loss100: number
  damage100: number
  haircut: number
  ltvAfter: number
  worstDepth: number
  floodScore: number
}

export interface Customer {
  id: string
  name: string
  sector: string
  occupancy: string
  segment: string
  rating: string
  tenorYears: number
  exposure: number
  collateralValue: number
  annualMargin: number
  ltv: number
  assetValue: number
  heatScore: number
  facilities: Facility[]
  scenarios: Record<Scenario, ScenarioCustomer>
}

export interface ScenarioTotals {
  aal: number
  aalRatio: number
  aalVsMargin: number
  loss100: number
  loss100PctAsset: number
  ltvBreach: number
  newBreach: number
  haircutWeighted: number
}

export interface Portfolio {
  asOf: string
  currency: string
  institution: string
  scenarios: Record<Scenario, number>
  totals: {
    customers: number
    facilities: number
    exposure: number
    collateral: number
    annualMargin: number
    assetValue: number
  } & Record<Scenario, ScenarioTotals>
  byDistrict: { district: string; assetValue: number; floodScore: number }[]
  bySector: { sector: string; exposure: number }[]
  customers: Customer[]
}

export interface ModelDoc {
  flood: {
    method: string
    dem: string
    resolution_m: number
    parameters: {
      pond_scale_m: number
      basin_scale_m: number
      flat_scale: number
      low_scale_m: number
      weights: Record<string, number>
    }
    scenarios: Record<string, number>
    calibration: string
    rejected_terms: string[]
  }
  heat: {
    method: string
    baseline_years: string
    baseline: Record<string, number>
    scenarios: Record<string, number>
    detail: Record<string, Record<string, number>>
  }
  validation: {
    sites: { label: string; flood: number; heat: number }[]
    n_sites: number
    built_up_quartile_threshold: number
    built_up_p90_threshold: number
    captured_in_top_quartile: number
    capture_rate: number
    median_percentile_rank: number
    expected_by_chance: number
    tuning?: {
      configurations: number
      capture_best: number
      capture_median: number
      capture_p90: number
      capture_worst: number
      capture_share_at_best: number
      medrank_best: number
      medrank_median: number
      fitted_on: string
    }
  }
  grid: { x0: number; y0: number; z: number; width: number; height: number; meters_per_px: number }
}
