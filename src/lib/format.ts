import type { Customer, Scenario } from './types'

/** Compact AED for headline numbers. */
export function money(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}bn`
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 1)}m`
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}k`
  return v.toFixed(0)
}

export function aed(v: number): string {
  return `AED ${money(v)}`
}

export function pct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

export function num(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export type Band = 'low' | 'moderate' | 'high' | 'severe'

export const BAND_COLOR: Record<Band, string> = {
  low: '#34d399',
  moderate: '#fbbf24',
  high: '#fb7185',
  severe: '#f04438',
}

export const BAND_LABEL: Record<Band, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  severe: 'Severe',
}

export function band(score: number): Band {
  if (score >= 75) return 'severe'
  if (score >= 55) return 'high'
  if (score >= 32) return 'moderate'
  return 'low'
}

/** Continuous colour along the risk ramp, matching the map overlays. */
export function ramp(score: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [52, 211, 153]],
    [30, [56, 189, 248]],
    [55, [251, 191, 36]],
    [75, [251, 113, 133]],
    [100, [240, 68, 56]],
  ]
  const s = clamp(score, 0, 100)
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i]
    const [p1, c1] = stops[i + 1]
    if (s >= p0 && s <= p1) {
      const t = p1 === p0 ? 0 : (s - p0) / (p1 - p0)
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * t)
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * t)
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * t)
      return `rgb(${r}, ${g}, ${b})`
    }
  }
  return 'rgb(240, 68, 56)'
}

export const DETERMINATION_COLOR: Record<string, string> = {
  Subject: BAND_COLOR.severe,
  'Cannot determine': BAND_COLOR.moderate,
  'Not subject': BAND_COLOR.low,
}

/** Highest modelled heat score across a borrower's facilities for one scenario. */
export function customerHeat(c: Customer, s: Scenario): number {
  if (!c.facilities.length) return c.heatScore ?? 0
  return Math.max(...c.facilities.map((f) => f.heatScenarios?.[s] ?? f.heatScore))
}

export type Determination = 'Subject' | 'Not subject' | 'Cannot determine'

export interface DeterminationResult {
  state: Determination
  reason: string
}

/**
 * BCBS CRFR2 requires each exposure to be classified subject / not subject /
 * cannot determine. We only claim "not subject" when the modelled hazard is
 * genuinely negligible, and we refuse to claim "subject" where we have no
 * facility-level evidence — that honesty is the point of the disclosure.
 */
export function determine(c: Customer, s: Scenario): DeterminationResult {
  if (!c.facilities.length) {
    return { state: 'Cannot determine', reason: 'No geocoded collateral on record' }
  }
  const sc = c.scenarios[s]
  const sites = `${c.facilities.length} site${c.facilities.length === 1 ? '' : 's'}`
  if (sc.worstDepth >= 0.2 || sc.floodScore >= 55) {
    return {
      state: 'Subject',
      reason: `Modelled 1-in-100 depth up to ${sc.worstDepth.toFixed(2)} m across ${sites}`,
    }
  }
  if (sc.worstDepth < 0.1 && sc.floodScore < 45) {
    return {
      state: 'Not subject',
      reason: `Depth below 0.10 m at every site (worst ${sc.worstDepth.toFixed(2)} m)`,
    }
  }
  return {
    state: 'Cannot determine',
    reason: `Worst modelled depth ${sc.worstDepth.toFixed(2)} m sits in the inconclusive band`,
  }
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '')
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
