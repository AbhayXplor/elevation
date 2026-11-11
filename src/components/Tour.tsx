import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { portfolio } from '@/lib/portfolio'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

type Lang = 'en' | 'ar'
type Copy = { title: string; body: string }

/** The borrower with the largest exposure makes the strongest example. */
const LEAD =
  [...portfolio.customers].sort((a, b) => b.exposure - a.exposure)[0]?.id ?? portfolio.customers[0].id

type Step = {
  target: string
  view: 'overview' | 'map' | 'portfolio' | 'evidence'
  customer?: string
  en: Copy
  ar: Copy
}

const STEPS: Step[] = [
  {
    target: 'nav-overview',
    view: 'overview',
    en: {
      title: 'Start with the whole book',
      body: 'Three numbers decide everything: what is exposed, what a 1-in-100 flood costs, and how much capital it would consume.',
    },
    ar: {
      title: 'ابدأ بالمحفظة كاملة',
      body: 'ثلاثة أرقام تحدد كل شيء: حجم الانكشاف، وخسارة فيضان مرة كل مئة عام، ورأس المال الذي تستهلكه.',
    },
  },
  {
    target: 'overview-kpis',
    view: 'overview',
    en: {
      title: '27 borrowers · AED 5.69bn',
      body: 'Every figure here is computed from the buildings underneath it — not typed in.',
    },
    ar: {
      title: '٢٧ عميلًا · ٥٫٦٩ مليار درهم',
      body: 'كل رقم هنا محسوب من المباني التي يقف عليها — لا مكتوب يدويًا.',
    },
  },
  {
    target: 'scenario',
    view: 'overview',
    en: {
      title: 'Move the clock',
      body: 'Switch to 2050 and watch the loss and the LTV breaches move with it. That contrast is the entire argument.',
    },
    ar: {
      title: 'حرّك الزمن',
      body: 'انتقل إلى ٢٠٥٠ وراقب تحرّك الخسارة وحالات تجاوز الحد. هذا التباين هو الحجة كلها.',
    },
  },
  {
    target: 'nav-map',
    view: 'map',
    en: {
      title: 'Then go down to the building',
      body: 'Scores come from 30-metre terrain and drainage, so two buildings in one district can land far apart.',
    },
    ar: {
      title: 'ثم انزل إلى المبنى',
      body: 'تُحسب الدرجات من تضاريس بدقة ٣٠ مترًا ومن التصريف، لذا يختلف مبنيان في الحي نفسه اختلافًا كبيرًا.',
    },
  },
  {
    target: 'nav-portfolio',
    view: 'portfolio',
    customer: LEAD,
    en: {
      title: 'Here is one, fully worked',
      body: 'Exposure, collateral, haircut, CRFR2 state — each traced to the clause it answers, with a written credit note.',
    },
    ar: {
      title: 'وهذا عميل كامل التفصيل',
      body: 'الانكشاف والضمان والخصم وتصنيف CRFR2 — كل بند يعود إلى اللائحة، مع ملاحظة ائتمان مكتوبة.',
    },
  },
  {
    target: 'nav-evidence',
    view: 'evidence',
    en: {
      title: 'And here is why you should believe it',
      body: '12 of the 20 districts flooded in April 2024 rank top-quarter. We publish all 180 configurations, including the awkward part.',
    },
    ar: {
      title: 'وهنا سبب الثقة به',
      body: '١٢ من ٢٠ منطقة غرقت في أبريل ٢٠٢٤ جاءت في الربع الأعلى. ننشر الإعدادات المئة والثمانين كاملة، بما فيها الجزء المحرج.',
    },
  },
]

const UI = {
  en: { of: 'of', skip: 'Skip', back: 'Back', next: 'Next', done: 'Got it', lang: 'عربي', dir: 'ltr' as const },
  ar: { of: 'من', skip: 'تخطي', back: 'السابق', next: 'التالي', done: 'فهمت', lang: 'English', dir: 'rtl' as const },
}

export const TOUR_KEY = 'elevation.tour.v1'
const LANG_KEY = 'elevation.lang'

type Place = { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom'; arrow: number }

const W = 348
const GAP = 14

/**
 * The first laid-out match — the sidebar is hidden on narrow screens and the
 * tab bar on wide ones. `offsetParent` is useless here because the tab bar is
 * fixed, so measure the box instead.
 */
function findTarget(name: string): HTMLElement | null {
  const nodes = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)]
  return nodes.find((n) => n.getClientRects().length > 0 && n.getBoundingClientRect().width > 0) ?? null
}

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setView, setSelectedCustomer } = useStore()
  const [i, setI] = useState(0)
  const [lang, setLangState] = useState<Lang>(() =>
    window.localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en',
  )
  const [hole, setHole] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const card = useRef<HTMLDivElement>(null)

  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const copy = step[lang]
  const t = UI[lang]

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      window.localStorage.setItem(LANG_KEY, next)
    } catch {
      // Private mode: the choice lasts for this session only.
    }
  }

  const go = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(STEPS.length - 1, n))
      setI(next)
      setView(STEPS[next].view)
      setSelectedCustomer(STEPS[next].customer ?? null)
    },
    [setView, setSelectedCustomer],
  )

  // Follow the highlighted element: re-measure after the view above it changes.
  useEffect(() => {
    if (!open) return
    let alive = true

    const measure = () => {
      if (!alive) return
      const el = findTarget(step.target)
      const vw = window.innerWidth
      const vh = window.innerHeight

      if (!el) {
        setHole(null)
        setPlace({ x: Math.max(12, vw / 2 - W / 2), y: vh / 2 - 110, side: 'bottom', arrow: 0 })
        return
      }

      const r = el.getBoundingClientRect()
      setHole({ x: r.left, y: r.top, w: r.width, h: r.height })

      // The card is already laid out at width W, so its height is knowable now.
      const ch = card.current?.offsetHeight ?? 170
      let side: Place['side'] = 'right'
      if (vw - r.right >= W + GAP + 8) side = 'right'
      else if (r.left >= W + GAP + 8) side = 'left'
      else if (vh - r.bottom >= ch + GAP) side = 'bottom'
      else side = 'top'

      let x: number
      let y: number
      if (side === 'right') {
        x = r.right + GAP
        y = r.top + r.height / 2 - ch / 2
      } else if (side === 'left') {
        x = r.left - W - GAP
        y = r.top + r.height / 2 - ch / 2
      } else if (side === 'bottom') {
        x = r.left + r.width / 2 - W / 2
        y = r.bottom + GAP
      } else {
        x = r.left + r.width / 2 - W / 2
        y = r.top - ch - GAP
      }

      x = Math.min(Math.max(12, x), vw - W - 12)
      y = Math.min(Math.max(12, y), vh - ch - 12)

      // Keep the arrow on the part of the card that faces the element.
      const cy = r.top + r.height / 2
      const cx = r.left + r.width / 2
      const arrow =
        side === 'right' || side === 'left'
          ? Math.min(Math.max(20, cy - y), ch - 20)
          : Math.min(Math.max(24, cx - x), W - 24)

      setPlace({ x, y, side, arrow })
    }

    const timer = setTimeout(measure, 90)
    window.addEventListener('resize', measure)
    return () => {
      alive = false
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
    }
  }, [open, i, step.target, lang])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(lang === 'en' ? i + 1 : i - 1)
      if (e.key === 'ArrowLeft') go(lang === 'en' ? i - 1 : i + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, i, lang, go, onClose])

  if (!open) return null

  const arrowStyle =
    place?.side === 'right'
      ? { left: -5, top: place.arrow - 5 }
      : place?.side === 'left'
        ? { right: -5, top: place.arrow - 5 }
        : place?.side === 'bottom'
          ? { top: -5, left: place.arrow - 5 }
          : { bottom: -5, left: (place?.arrow ?? 0) - 5 }

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0" onClick={onClose} />

      {hole && (
        <div
          className="pointer-events-auto absolute rounded-lg"
          style={{ left: hole.x - 3, top: hole.y - 3, width: hole.w + 6, height: hole.h + 6 }}
        >
          <div className="absolute inset-0 rounded-lg shadow-[0_0_0_9999px_rgba(5,6,8,0.74)] ring-1 ring-accent/45" />
        </div>
      )}
      {!hole && <div className="absolute inset-0 bg-canvas/74" />}

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        dir={t.dir}
        style={{ left: place?.x ?? 0, top: place?.y ?? 0, width: W, opacity: place ? 1 : 0 }}
        className="absolute rounded-lg border border-line-2 bg-surface-2 p-3.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.95)] transition-[left,top] duration-200 ease-out"
      >
        {place && (
          <div
            style={arrowStyle}
            className="absolute h-2.5 w-2.5 rotate-45 border-line-2 bg-surface-2"
            // Only the two edges facing the element get a border, so the arrow
            // looks like part of the card rather than a floating diamond.
          >
            <span
              className={cn(
                'absolute inset-0 rotate-0',
                place.side === 'right' && 'border-b border-l',
                place.side === 'left' && 'border-r border-t',
                place.side === 'bottom' && 'border-l border-t',
                place.side === 'top' && 'border-r border-b',
              )}
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.11em] text-ink-4">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {i + 1} {t.of} {STEPS.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="rounded border border-line-2 px-1.5 py-[2px] text-[10px] text-ink-3 transition-colors hover:text-ink"
            >
              {t.lang}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded p-0.5 text-ink-4 transition-colors hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <h2 className="mt-2 text-[14px] font-semibold leading-snug tracking-[-0.015em] text-ink">
          {copy.title}
        </h2>
        <p className="mt-1.5 text-[11.5px] leading-[1.6] text-ink-2">{copy.body}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {STEPS.map((_, n) => (
              <button
                key={n}
                onClick={() => go(n)}
                aria-label={`Step ${n + 1}`}
                className={cn(
                  'h-[3px] w-4 rounded-full transition-colors',
                  n === i ? 'bg-accent' : n < i ? 'bg-accent/40' : 'bg-line-2',
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={() => go(i - 1)} className="px-1.5 text-ink-3">
                {t.dir === 'rtl' ? <ArrowRight size={13} /> : <ArrowLeft size={13} />}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => (last ? onClose() : go(i + 1))}>
              {last ? t.done : t.next}
              {!last && (t.dir === 'rtl' ? <ArrowLeft size={12} /> : <ArrowRight size={12} />)}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="px-1 text-[10px] text-ink-4">
              {t.skip}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
