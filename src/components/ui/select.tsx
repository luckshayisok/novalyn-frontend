import { Check, ChevronDown } from 'lucide-react'
import { Checkbox as CheckboxPrimitive, Select as SelectPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value

function SelectTrigger({
  className,
  children,
  size = 'default',
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & { size?: 'default' | 'sm' }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm',
        'transition-[border-color,box-shadow] data-[placeholder]:text-muted-foreground/80',
        'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
        'aria-invalid:border-destructive [&>span]:truncate',
        size === 'sm' ? 'h-8 text-[13px]' : 'h-9',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={4}
        className={cn(
          'relative z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  description,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item> & { description?: string | null }) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-pointer select-none items-start rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none',
        'data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="flex flex-col">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
      <span className="absolute right-2 top-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4 text-brand" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer size-4 shrink-0 rounded-sm border border-input bg-card transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/** Browser-native select, for long lists (time zones) where the platform picker works best. */
function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-sm text-foreground',
          'transition-[border-color,box-shadow]',
          'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
          'aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  )
}

export { Checkbox, NativeSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
