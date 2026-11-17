import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { documentKeys } from '@/services/documents'
import { lifecycleKeys } from '@/services/lifecycle'
import { queryKeys } from '@/services/organizations'
import type { RenewalStatus } from '@/types/api'

export const RENEWAL_STATUS: Record<
  RenewalStatus,
  { label: string; variant: 'neutral' | 'brand' | 'warning' | 'success' | 'destructive' | 'outline' }
> = {
  not_started: { label: 'Not started', variant: 'outline' },
  requested: { label: 'Requested', variant: 'neutral' },
  in_progress: { label: 'In progress', variant: 'brand' },
  submitted: { label: 'File uploaded', variant: 'brand' },
  awaiting_approval: { label: 'Awaiting approval', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

export function RenewalBadge({ status }: { status: RenewalStatus }) {
  const { label, variant } = RENEWAL_STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function deadlinePhrase(days: number | null): string | null {
  if (days === null) return null
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days} day${days === 1 ? '' : 's'}`
}

/** Refresh everything a renewal change can affect. */
export function useRefreshRenewals(organizationId: string) {
  const queryClient = useQueryClient()
  return useCallback(
    () =>
      Promise.all(
        [
          lifecycleKeys.renewals(organizationId),
          lifecycleKeys.unread(organizationId),
          documentKeys.all(organizationId),
          documentKeys.dashboard(organizationId),
          queryKeys.auditLogs(organizationId),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
    [queryClient, organizationId],
  )
}
