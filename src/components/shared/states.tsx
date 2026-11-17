import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-muted-foreground', className)} aria-hidden />
}

/** Full-area loader for route-level loading. */
export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center" role="status">
      <Spinner className="size-5" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="flex size-10 items-center justify-center rounded-md bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  error: unknown
  title?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ error, title = 'This could not be loaded', onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)} role="alert">
      <div className="flex size-10 items-center justify-center rounded-md bg-destructive-soft">
        <AlertCircle className="size-5 text-destructive" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

const NOTICE_STYLES = {
  info: { icon: Info, box: 'border-brand/20 bg-brand-soft', iconColor: 'text-brand' },
  success: { icon: CheckCircle2, box: 'border-success/20 bg-success-soft', iconColor: 'text-success' },
  warning: { icon: TriangleAlert, box: 'border-warning/25 bg-warning-soft', iconColor: 'text-warning' },
  error: { icon: AlertCircle, box: 'border-destructive/20 bg-destructive-soft', iconColor: 'text-destructive' },
} as const

interface NoticeProps {
  variant?: keyof typeof NOTICE_STYLES
  title?: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}

/** Inline message block: form errors, confirmations, warnings. */
export function Notice({ variant = 'info', title, children, action, className }: NoticeProps) {
  const style = NOTICE_STYLES[variant]
  const Icon = style.icon
  return (
    <div
      className={cn('flex items-start gap-3 rounded-md border px-3.5 py-3 text-[13px]', style.box, className)}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', style.iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className={cn('text-foreground/80', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
