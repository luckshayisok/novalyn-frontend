import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Upload } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/shared/misc'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/features/documents/controls'
import {
  DocumentTable,
  ENTITY_TYPE_LABELS,
  EntityTypeBadge,
  NoDocuments,
  useOptions,
  useRefreshDocuments,
} from '@/features/documents/shared'
import { useOrganization } from '@/hooks/useOrganization'
import { ApiError, errorMessage } from '@/lib/http'
import { formatDateTime } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { documentKeys, documentService, entityKeys, entityService } from '@/services/documents'

import { EntityDialog } from './EntityDialog'

const PAGE_SIZE = 20

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted-foreground">–</span>}</dd>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warning' | 'destructive' }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'destructive' && value > 0
            ? 'text-xl font-semibold tabular-nums text-destructive'
            : tone === 'warning' && value > 0
              ? 'text-xl font-semibold tabular-nums text-warning'
              : 'text-xl font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  )
}

export function EntityDetailPage() {
  const { entityId = '' } = useParams()
  const { organization, can } = useOrganization()
  const org = paths.org(organization.slug)
  const { categoryLabel } = useOptions()
  const queryClient = useQueryClient()
  const refresh = useRefreshDocuments(organization.id)
  const [dialog, setDialog] = useState<'edit' | 'archive' | null>(null)
  const [page, setPage] = useState(1)

  const entity = useQuery({
    queryKey: entityKeys.detail(organization.id, entityId),
    queryFn: () => entityService.get(organization.id, entityId),
  })
  const docParams = { entity_id: entityId, sort: 'expiry_date', page, page_size: PAGE_SIZE }
  const documents = useQuery({
    queryKey: documentKeys.list(organization.id, docParams),
    queryFn: () => documentService.list(organization.id, docParams),
    placeholderData: keepPreviousData,
  })

  const restore = useMutation({
    mutationFn: () => entityService.restore(organization.id, entityId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(entityKeys.detail(organization.id, entityId), updated)
      await refresh()
      toast.success('Restored.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
      <Link to={entity.data ? `${org.entities}?type=${entity.data.type}` : org.entities}>
        <ArrowLeft aria-hidden />
        {entity.data ? ENTITY_TYPE_LABELS[entity.data.type].plural : 'Entities'}
      </Link>
    </Button>
  )

  if (entity.isPending) return <PageLoader label="Loading" />
  if (entity.isError) {
    const missing = entity.error instanceof ApiError && entity.error.status === 404
    return (
      <>
        {back}
        <Card>
          {missing ? (
            <EmptyState icon={ENTITY_TYPE_LABELS.supplier.icon} title="Not found" description="This record does not exist." />
          ) : (
            <ErrorState error={entity.error} onRetry={() => void entity.refetch()} />
          )}
        </Card>
      </>
    )
  }

  const item = entity.data
  const archived = item.archived_at !== null
  const canWrite = can('entities:write')
  const Icon = ENTITY_TYPE_LABELS[item.type].icon
  const uploadLink = `${org.upload}?entity=${item.id}`

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold leading-7">{item.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <EntityTypeBadge type={item.type} />
              {item.code && <span className="text-[13px] text-muted-foreground">{item.code}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('documents:write') && !archived && (
            <Button asChild variant="outline">
              <Link to={uploadLink}>
                <Upload aria-hidden />
                Upload documents
              </Link>
            </Button>
          )}
          {canWrite && !archived && (
            <Button variant="outline" onClick={() => setDialog('edit')}>
              <Pencil aria-hidden />
              Edit
            </Button>
          )}
          {canWrite &&
            (archived ? (
              <Button variant="outline" loading={restore.isPending} onClick={() => restore.mutate()}>
                <ArchiveRestore aria-hidden />
                Restore
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setDialog('archive')}>
                <Archive aria-hidden />
                Archive
              </Button>
            ))}
        </div>
      </div>

      {archived && (
        <Notice variant="info" title="This record is archived" className="mb-6">
          New documents cannot be attached to it. Documents already attached are unchanged.
        </Notice>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Documents" value={item.document_count} />
        <Stat label="Expiring soon" value={item.expiring_soon_count} tone="warning" />
        <Stat label="Expired" value={item.expired_count} tone="destructive" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              {item.contact_name !== null && <Field label="Contact">{item.contact_name}</Field>}
              {(item.type === 'employee' || item.type === 'supplier') && (
                <>
                  <Field label="Email">
                    {item.email && (
                      <a href={`mailto:${item.email}`} className="text-brand hover:underline">
                        {item.email}
                      </a>
                    )}
                  </Field>
                  <Field label="Phone">{item.phone}</Field>
                </>
              )}
              {item.type !== 'location' && (
                <Field label="Location">
                  {item.location && (
                    <Link to={org.entity(item.location.id)} className="text-brand hover:underline">
                      {item.location.name}
                    </Link>
                  )}
                </Field>
              )}
              {item.type !== 'location' && item.type !== 'department' && (
                <Field label="Department">
                  {item.department && (
                    <Link to={org.entity(item.department.id)} className="text-brand hover:underline">
                      {item.department.name}
                    </Link>
                  )}
                </Field>
              )}
              <Field label="Responsible">{item.owner?.full_name}</Field>
              {item.address !== null && (
                <Field label="Address">
                  <span className="whitespace-pre-wrap">{item.address}</span>
                </Field>
              )}
              <Field label="Notes">{item.notes && <span className="whitespace-pre-wrap">{item.notes}</span>}</Field>
              <Field label="Added">{formatDateTime(item.created_at)}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card className={documents.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Soonest expiry first.</CardDescription>
          </CardHeader>
          {documents.isPending ? (
            <div className="flex flex-col gap-3 px-5 pb-5">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-8" />
              ))}
            </div>
          ) : documents.isError ? (
            <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
          ) : documents.data.items.length === 0 ? (
            <NoDocuments
              title="No documents attached"
              description="Upload a document here, or attach an existing one from its own page."
              action={
                can('documents:write') &&
                !archived && (
                  <Button asChild variant="outline">
                    <Link to={uploadLink}>
                      <Upload aria-hidden />
                      Upload documents
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <>
              <DocumentTable
                documents={documents.data.items}
                organizationSlug={organization.slug}
                categoryLabel={categoryLabel}
                hideEntity
              />
              {documents.data.total > PAGE_SIZE && (
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={documents.data.total}
                  busy={documents.isFetching}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </Card>
      </div>

      {dialog === 'edit' && (
        <EntityDialog
          organizationId={organization.id}
          entity={item}
          defaultType={item.type}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onSaved={async (updated) => {
            queryClient.setQueryData(entityKeys.detail(organization.id, entityId), updated)
            await refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'archive'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Archive ${item.name}?`}
        description="It is hidden from lists and pickers. Its documents are not changed, and you can restore it at any time."
        confirmLabel="Archive"
        onConfirm={async () => {
          const updated = await entityService.archive(organization.id, entityId)
          queryClient.setQueryData(entityKeys.detail(organization.id, entityId), updated)
          await refresh()
          toast.success('Archived.')
        }}
      />
    </>
  )
}
