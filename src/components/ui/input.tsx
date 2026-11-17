import { Label as LabelPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground',
        'placeholder:text-muted-foreground/70 transition-[border-color,box-shadow]',
        'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
        'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20',
        className,
      )}
      {...props}
    />
  )
}

function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-[13px] font-medium leading-none text-foreground', className)}
      {...props}
    />
  )
}

export { Input, Label }
