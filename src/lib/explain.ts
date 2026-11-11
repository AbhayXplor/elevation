import { customerHeat, money, pct } from './format'
import type { Customer, Scenario } from './types'

export type Explanation = { text: string; source: 'model' | 'fallback'; model?: string }

function factsFor(c: Customer, s: Scenario) {
  const sc = c.scenarios[s]
  const districts = [...new Set(c.facilities.map((f) => f.district))]
  const worst = [...c.facilities].sort((a, b) => b.scenarios[s].depth - a.scenarios[s].depth)[0]

  return {
    borrower: {
      name: c.name,
      sector: c.sector,
      segment: c.segment,
      rating: c.rating,
    },
    scenario: s === 'now' ? 'baseline' : `${s} projection`,
    exposure: `AED ${money(c.exposure)}`,
    collateral: `AED ${money(c.collateralValue)}`,
    sites: c.facilities.length,
    districts,
    // Some facility names already end in their district; the sentence adds it
    // only when it is missing, so it never reads "...in Business Bay in Business Bay".
    worst_site: worst ? worst.name.trim() : 'none recorded',
    worst_district: worst ? worst.district : 'not recorded',
    worst_depth: worst ? `${worst.scenarios[s].depth.toFixed(2)} m` : 'not modelled',
    pluvial_score: Math.round(sc.floodScore),
    heat_score: Math.round(customerHeat(c, s)),
    loss_1_in_100: `AED ${money(sc.loss100)}`,
    collateral_impairment: pct(sc.haircut),
    ltv_before: pct(c.ltv, 0),
    ltv_after: pct(sc.ltvAfter, 0),
    ltv_limit_breached: sc.ltvAfter > 0.9,
    clause: 'CBUAE C 8/2025 §4.7.5 (transmission channels) and §4.7.4 (exposure magnitude)',
  }
}

export type Facts = ReturnType<typeof factsFor>

/** Deterministic text built from the same facts; shown before and instead of the model. */
export function fallbackExplanation(c: Customer, s: Scenario): string {
  const f = factsFor(c, s)
  const where =
    f.districts.length === 1
      ? f.districts[0]
      : `${f.districts[0]} and ${f.districts.length - 1} other district${f.districts.length > 2 ? 's' : ''}`
  // Some site names carry the district after a separator, and a few are
  // truncated to a stub, in which case the district is the better label.
  const [head, tail] = f.worst_site.split('·').map((s) => s.trim())
  const label = head && head.length >= 4 ? head : tail || head || f.worst_site
  const site = label.includes(f.worst_district) ? label : `${label} in ${f.worst_district}`

  return (
    `${c.name} holds ${f.sites} site${f.sites === 1 ? '' : 's'} across ${where}, with the deepest modelled ponding at ${f.worst_depth} at ${site}. ` +
    `In a 1-in-100 pluvial event that impairs ${f.collateral_impairment} of the collateral and moves loan-to-value from ${f.ltv_before} to ${f.ltv_after}${f.ltv_limit_breached ? ', past the 90% limit' : ''}, for a loss of ${f.loss_1_in_100}. ` +
    `This supports ${f.clause}.`
  )
}

/**
 * Asks the server for a written explanation, falling back to the deterministic
 * text on any failure so the screen always reads.
 */
export async function explain(c: Customer, s: Scenario): Promise<Explanation> {
  const fallback: Explanation = { text: fallbackExplanation(c, s), source: 'fallback' }

  try {
    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(factsFor(c, s)),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return fallback

    const body = (await res.json()) as { text?: unknown; model?: unknown }
    if (typeof body.text !== 'string' || body.text.trim().length < 60) return fallback

    return {
      text: body.text.trim(),
      source: 'model',
      model: typeof body.model === 'string' ? body.model : undefined,
    }
  } catch {
    return fallback
  }
}
