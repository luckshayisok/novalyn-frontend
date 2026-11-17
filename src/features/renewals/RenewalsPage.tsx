import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { RefreshCcw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/shared/misc'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination } from '@/features/documents/controls'
import { formatDay, StatusBadge } from '@/features/documents/shared'
import { useOrganization } from '@/hooks/useOrganization'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { lifecycleKeys, renewalService, type RenewalListFilter } from '@/services/lifecycle'

import { deadlinePhrase, RenewalBadge } from './shared'

const PAGE_SIZE = 25
const TABS: Array<{ value: RenewalListFilter; label: string }> = [
  { value: 'open', label: 'In progress' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'closed', label: 'Closed' },
]

export function RenewalsPage() {
  const { organization } = useOrganization()
  const org = paths.org(organization.slug)
  const [searchParams, setSearchParams] = useSearchParams()
  const status = TABS.find((tab) => tab.value === searchParams.get('status'))?.value ?? 'open'
  const mine = searchParams.get('mine') === '1'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const params = { status, mine, page, page_size: PAGE_SIZE }
  const list = useQuery({
    queryKey: lifecycleKeys.renewalList(organization.id, params),
    queryFn: () => renewalService.list(organization.id, params),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader
        title="Renewals"
        description="Documents being renewed: who is doing it, by when, and what is waiting for approval."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Renewal status">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={tab.value === status}
              onClick={() => update({ status: tab.value === 'open' ? '' : tab.value })}
              className={cn(
                '-mb-px h-10 border-b-2 px-3 text-sm font-medium transition-colors',
                tab.value === status
                  ? 'border-brand text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <Checkbox checked={mine} onCheckedChange={(next) => update({ mine: next === true ? '1' : '' })} />
          Assigned to me
        </label>
      </div>

      <Card className={list.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}>
        {list.isPending ? (
          <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading">
            {Array.from({ length: 4 }, (_, row) => (
              <Skeleton key={row} className="h-8" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={RefreshCcw}
            title={status === 'closed' ? 'No closed renewals' : 'Nothing here'}
            description={
              status === 'open'
                ? 'Start a renewal from a document page when it is due for renewal.'
                : 'No renewals match this view.'
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="pr-5">Document expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((renewal) => (
                  <TableRow key={renewal.id}>
                    <TableCell className="max-w-[300px] pl-5">
                      <Link to={org.renewal(renewal.id)} className="block truncate rounded-sm font-medium hover:text-brand">
                        {renewal.document.name}
                      </Link>
                      {renewal.document.entity && (
                        <p className="truncate text-xs text-muted-foreground">{renewal.document.entity.name}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <RenewalBadge status={renewal.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{renewal.assignee?.full_name ?? 'Nobody yet'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {renewal.deadline ? (
                        <>
                          <span className="tabular-nums">{formatDay(renewal.deadline)}</span>
                          {renewal.status !== 'completed' && renewal.status !== 'rejected' && (
                            <span className={cn('block text-xs', renewal.overdue ? 'text-destructive' : 'text-muted-foreground')}>
                              {deadlinePhrase(renewal.days_to_deadline)}
                            </span>
                          )}
                        </>
                      ) : (
                        '–'
                      )}
                    </TableCell>
                    <TableCell className="pr-5">
                      <span className="flex flex-wrap items-center gap-2">
                        {renewal.document.expiry_date ? formatDay(renewal.document.expiry_date) : '–'}
                        <StatusBadge document={renewal.document} />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={list.data.total}
              busy={list.isFetching}
              onPageChange={(next) => update({ page: next > 1 ? String(next) : '' })}
            />
          </>
        )}
      </Card>
    </>
  )
}
