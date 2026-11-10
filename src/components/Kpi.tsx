import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './ui/primitives'

export function Kpi({
  label,
  value,
  unit,
  sub,
  bar,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  bar?: ReactNode
  tone?: 'default' | 'warn' | 'danger'
}) {
  return (
    <div className="group relative overflow-hidden rounded-[10px] border border-line bg-surface p-3.5 transition-colors duration-200 hover:border-line-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {tone !== 'default' && (
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              tone === 'danger' ? 'bg-risk-severe' : 'bg-risk-mod',
            )}
          />
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="mono text-[23px] font-medium leading-none tracking-[-0.03em] text-ink">
          {value}
        </span>
        {unit && <span className="text-[10.5px] font-medium text-ink-3">{unit}</span>}
      </div>
      {bar && <div className="mt-2.5">{bar}</div>}
      {sub && <div className="mt-1.5 text-[11px] leading-snug text-ink-3">{sub}</div>}
    </div>
  )
}
