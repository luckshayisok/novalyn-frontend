import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/shared/misc'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Badge, Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination, SearchInput } from '@/features/documents/controls'
import { ENTITY_TYPE_LABELS, ENTITY_TYPES, useRefreshDocuments } from '@/features/documents/shared'
import { useOrganization } from '@/hooks/useOrganization'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { entityKeys, entityService } from '@/services/documents'
import type { EntityType } from '@/types/api'

import { EntityDialog } from './EntityDialog'

const PAGE_SIZE = 25

export function EntitiesPage() {
  const { organization, can } = useOrganization()
  const org = paths.org(organization.slug)
  const navigate = useNavigate()
  const refresh = useRefreshDocuments(organization.id)
  const [searchParams, setSearchParams] = useSearchParams()
  const [adding, setAdding] = useState(false)

  const type = (ENTITY_TYPES.find((item) => item === searchParams.get('type')) ?? 'employee') as EntityType
  const q = searchParams.get('q') ?? ''
  const archived = searchParams.get('archived') === '1'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const labels = ENTITY_TYPE_LABELS[type]

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const counts = useQuery({
    queryKey: entityKeys.counts(organization.id),
    queryFn: () => entityService.counts(organization.id),
  })
  const params = { type, q: q || undefined, archived, page, page_size: PAGE_SIZE }
  const list = useQuery({
    queryKey: entityKeys.list(organization.id, params),
    queryFn: () => entityService.list(organization.id, params),
    placeholderData: keepPreviousData,
  })

  const canWrite = can('entities:write')

  return (
    <>
      <PageHeader
        title="Entities"
        description="The people, suppliers, equipment and places your documents belong to."
        actions={
          canWrite && (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              Add {labels.singular.toLowerCase()}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5 border-b" role="tablist" aria-label="Kind of record">
        {ENTITY_TYPES.map((value) => {
          const Icon = ENTITY_TYPE_LABELS[value].icon
          const count = counts.data?.find((item) => item.type === value)?.count
          const active = value === type
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => update({ type: value, q: '' })}
              className={cn(
                '-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-brand text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {ENTITY_TYPE_LABELS[value].plural}
              {count !== undefined && (
                <span className="rounded-sm bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <SearchInput
          key={`${type}-${q}`}
          value={q}
          onChange={(value) => update({ q: value.trim() })}
          placeholder={`Search ${labels.plural.toLowerCase()} by name, code or email`}
          label={`Search ${labels.plural.toLowerCase()}`}
          className="max-w-sm"
        />
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <Checkbox checked={archived} onCheckedChange={(next) => update({ archived: next === true ? '1' : '' })} />
          Show archived
        </label>
      </div>

      <Card className={list.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}>
        {list.isPending ? (
          <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading">
            {Array.from({ length: 5 }, (_, row) => (
              <Skeleton key={row} className="h-8" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={labels.icon}
            title={q ? `No ${labels.plural.toLowerCase()} match "${q}"` : `No ${labels.plural.toLowerCase()} yet`}
            description={
              archived
                ? 'Nothing has been archived here.'
                : `Add ${labels.plural.toLowerCase()} so that documents can be attached to them.`
            }
            action={
              canWrite &&
              !q &&
              !archived && (
                <Button variant="outline" onClick={() => setAdding(true)}>
                  <Plus aria-hidden />
                  Add {labels.singular.toLowerCase()}
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Name</TableHead>
                  <TableHead>{type === 'location' || type === 'department' ? 'Code' : 'Location'}</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead className="pr-5 text-right">Documents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="max-w-[320px] pl-5">
                      <Link to={org.entity(entity.id)} className="block truncate rounded-sm font-medium hover:text-brand">
                        {entity.name}
                      </Link>
                      {entity.code && type !== 'location' && type !== 'department' && (
                        <p className="truncate text-xs text-muted-foreground">{entity.code}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {type === 'location' || type === 'department' ? entity.code ?? '–' : entity.location?.name ?? '–'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entity.owner?.full_name ?? '–'}</TableCell>
                    <TableCell className="pr-5">
                      <div className="flex items-center justify-end gap-1.5 tabular-nums">
                        {entity.expired_count > 0 && <Badge variant="destructive">{entity.expired_count} expired</Badge>}
                        {entity.expiring_soon_count > 0 && (
                          <Badge variant="warning">{entity.expiring_soon_count} expiring</Badge>
                        )}
                        <span className="w-8 text-right">{entity.document_count}</span>
                      </div>
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

      {adding && (
        <EntityDialog
          organizationId={organization.id}
          entity={null}
          defaultType={type}
          open
          onOpenChange={(open) => !open && setAdding(false)}
          onSaved={async (created) => {
            await refresh()
            navigate(org.entity(created.id))
          }}
        />
      )}
    </>
  )
}
