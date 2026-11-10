import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-ink text-canvas hover:bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_6px_16px_-8px_rgba(0,0,0,0.9)] active:translate-y-px',
        secondary:
          'bg-surface-2 text-ink border border-line-2 hover:bg-surface-3 hover:border-[#343b46] active:translate-y-px',
        ghost: 'text-ink-2 hover:text-ink hover:bg-white/[0.04]',
        accent: 'bg-accent/15 text-accent border border-accent/25 hover:bg-accent/22',
        danger: 'bg-risk-severe/12 text-risk-severe border border-risk-severe/25 hover:bg-risk-severe/18',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12px]',
        md: 'h-8 px-3',
        lg: 'h-9 px-4',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
