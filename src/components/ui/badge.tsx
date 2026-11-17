import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium leading-4',
  {
    variants: {
      variant: {
        neutral: 'bg-secondary text-secondary-foreground',
        brand: 'bg-brand-soft text-brand',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        destructive: 'bg-destructive-soft text-destructive',
        outline: 'border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden {...props} />
}

function Separator({ className, ...props }: ComponentProps<'div'>) {
  return <div role="separator" className={cn('h-px w-full bg-border', className)} {...props} />
}

export { Badge, Separator, Skeleton }
