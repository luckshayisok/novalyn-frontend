import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react'
import { useState } from 'react'

import { PageHeader, UserAvatar } from '@/components/shared/misc'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrganization } from '@/hooks/useOrganization'
import { formatDateTime } from '@/lib/utils'
import { auditService, queryKeys } from '@/services/organizations'

import { actorName, describeAuditEntry } from './describe'

const PAGE_SIZE = 25

const FILTERS = [
  { value: '', label: 'All activity' },
  { value: 'document.', label: 'Documents' },
  { value: 'entity.', label: 'Entities' },
  { value: 'member.', label: 'Team' },
  { value: 'organization.', label: 'Organization' },
] as const

export function AuditLogPage() {
  const { organization } = useOrganization()
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<string>('')

  const params = { page, pageSize: PAGE_SIZE, action: action || undefined }
  const log = useQuery({
    queryKey: queryKeys.auditLogs(organization.id, params),
    queryFn: () => auditService.list(organization.id, params),
    placeholderData: keepPreviousData,
  })

  const total = log.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const last = Math.min(page * PAGE_SIZE, total)

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="A permanent record of changes in this organization. Entries cannot be edited or deleted."
      />

      <div className="mb-4 flex items-center gap-2.5">
        <Label htmlFor="audit-filter" className="text-muted-foreground">
          Show
        </Label>
        <div className="w-48">
          <NativeSelect
            id="audit-filter"
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Card className={log.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}>
        {log.isPending ? (
          <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading">
            {Array.from({ length: 6 }, (_, row) => (
              <Skeleton key={row} className="h-7" />
            ))}
          </div>
        ) : log.isError ? (
          <ErrorState error={log.error} onRetry={() => void log.refetch()} />
        ) : log.data.items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No entries"
            description={
              action ? 'Nothing matches this filter yet.' : 'Changes to the team and settings will appear here.'
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-48 pl-5">When</TableHead>
                  <TableHead className="w-64">Who</TableHead>
                  <TableHead className="pr-5">What happened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap pl-5 text-muted-foreground tabular-nums">
                      {formatDateTime(entry.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={actorName(entry)} className="size-7 text-[11px]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{actorName(entry)}</p>
                          {entry.actor && (
                            <p className="truncate text-xs text-muted-foreground">{entry.actor.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="pr-5">{describeAuditEntry(entry)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {first}–{last} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || log.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft aria-hidden />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount || log.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
