import { useId, useState, type ReactElement, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/input'
import { errorMessage } from '@/lib/http'
import { ROLE_LABELS } from '@/lib/permissions'
import { cn, initials } from '@/lib/utils'
import type { Role } from '@/types/api'

import { Notice } from './states'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-7">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

const ROLE_BADGE_VARIANT: Record<Role, 'brand' | 'neutral' | 'outline'> = {
  owner: 'brand',
  admin: 'brand',
  compliance_manager: 'neutral',
  member: 'neutral',
  viewer: 'outline',
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={ROLE_BADGE_VARIANT[role]}>{ROLE_LABELS[role]}</Badge>
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

interface FormFieldProps {
  label: string
  error?: string
  hint?: ReactNode
  /** Rendered on the same line as the label, right-aligned. */
  labelAction?: ReactNode
  className?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactElement
}

/** Label, control, hint and error message with the right ARIA wiring. */
export function FormField({ label, error, hint, labelAction, className, children }: FormFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const hasMessage = Boolean(error || hint)
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': hasMessage ? messageId : undefined })}
      {error ? (
        <p id={messageId} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  /** Runs when the user confirms. The dialog closes when it resolves and shows the error when it rejects. */
  onConfirm: () => Promise<unknown>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (pending) return
    if (!next) setError(null)
    onOpenChange(next)
  }

  const confirm = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <div className="flex flex-col gap-1.5">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </div>
        {error && <Notice variant="error">{error}</Notice>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button variant={destructive ? 'destructive' : 'default'} loading={pending} onClick={confirm}>
            {confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
