import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BAND_COLOR, band, type Band } from '@/lib/format'

/* ---------------------------------------------------------------- Panel */

export function Panel({
  className,
  children,
  flush,
}: {
  className?: string
  children: ReactNode
  flush?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-line bg-surface',
        'shadow-[0_1px_0_rgba(255,255,255,0.02)_inset]',
        !flush && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PanelHeader({
  title,
  hint,
  right,
  className,
}: {
  title: ReactNode
  hint?: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- Label */

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------ Risk pill */

export function RiskPill({ score, showScore = true }: { score: number; showScore?: boolean }) {
  const b: Band = band(score)
  const color = BAND_COLOR[b]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11px] font-medium tnum"
      style={{
        color,
        borderColor: `${color}33`,
        background: `${color}12`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {showScore ? score.toFixed(0) : null}
    </span>
  )
}

/* ------------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line bg-canvas p-0.5',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative rounded-[5px] font-medium transition-colors duration-150',
              size === 'sm' ? 'px-2 py-[3px] text-[11px]' : 'px-2.5 py-1 text-[12px]',
              active
                ? 'bg-surface-3 text-ink shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- Meter */

export function Meter({
  value,
  max = 1,
  color,
  height = 4,
  className,
  track = 'rgba(255,255,255,0.06)',
}: {
  value: number
  max?: number
  color: string
  height?: number
  className?: string
  track?: string
}) {
  const w = Math.max(0, Math.min(1, value / max)) * 100
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full', className)}
      style={{ height, background: track }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${w}%`, background: color }}
      />
    </div>
  )
}

/* ------------------------------------------------------------- Dot strip */

export function DotStrip({
  values,
  max = 100,
  height = 22,
}: {
  values: number[]
  max?: number
  height?: number
}) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((v, i) => {
        const h = Math.max(8, (Math.min(v, max) / max) * height)
        return (
          <div
            key={i}
            className="w-full rounded-[1px] transition-all duration-300"
            style={{ height: h, background: BAND_COLOR[band(v)], opacity: 0.35 + (v / max) * 0.65 }}
          />
        )
      })}
    </div>
  )
}
