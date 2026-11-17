import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  Download,
  EyeOff,
  Pencil,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/shared/misc'
import { EmptyState, ErrorState, Notice, PageLoader, Spinner } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrganization } from '@/hooks/useOrganization'
import { ApiError, errorMessage } from '@/lib/http'
import { formatDateTime } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { absoluteFileUrl, documentKeys, documentService } from '@/services/documents'
import type { DocumentDetail, DocumentVersion } from '@/types/api'

import { EditDocumentDialog, RejectDialog, ReplaceFileDialog } from './DocumentDialogs'
import { ExtractionPanel } from './ExtractionPanel'
import {
  expiryPhrase,
  FileIcon,
  formatBytes,
  formatDay,
  StatusBadge,
  useOptions,
  useRefreshDocuments,
  VerificationBadge,
} from './shared'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? <span className="text-muted-foreground">–</span>}</dd>
    </div>
  )
}

function Preview({ organizationId, document }: { organizationId: string; document: DocumentDetail }) {
  const version = document.current_version
  const preview = useQuery({
    queryKey: documentKeys.preview(organizationId, version?.id ?? 'none'),
    queryFn: () => documentService.fileUrl(organizationId, document.id, version?.id ?? '', 'inline'),
    enabled: Boolean(version?.previewable),
    // The link is short-lived, but the browser keeps what it already loaded.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  if (!version) {
    return <EmptyState icon={EyeOff} title="No file" description="This document has no file yet." />
  }
  if (!version.previewable) {
    return (
      <EmptyState
        icon={EyeOff}
        title="No preview for this file type"
        description="Word documents cannot be shown here. Download the file to open it."
      />
    )
  }
  if (preview.isPending) {
    return (
      <div className="flex h-[420px] items-center justify-center" role="status" aria-label="Loading preview">
        <Spinner className="size-5" />
      </div>
    )
  }
  if (preview.isError) return <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />

  const url = absoluteFileUrl(preview.data.url)
  return version.content_type.startsWith('image/') ? (
    <div className="flex max-h-[640px] justify-center overflow-auto bg-muted/40 p-4">
      <img src={url} alt={`Preview of ${version.original_filename}`} className="max-w-full rounded-sm object-contain" />
    </div>
  ) : (
    <iframe src={url} title={`Preview of ${version.original_filename}`} className="h-[640px] w-full bg-muted/40" />
  )
}

export function DocumentDetailPage() {
  const { documentId = '' } = useParams()
  const { organization, can } = useOrganization()
  const org = paths.org(organization.slug)
  const { categoryLabel } = useOptions()
  const queryClient = useQueryClient()
  const refresh = useRefreshDocuments(organization.id)

  const [dialog, setDialog] = useState<'edit' | 'replace' | 'reject' | 'archive' | null>(null)

  const query = useQuery({
    queryKey: documentKeys.detail(organization.id, documentId),
    queryFn: () => documentService.get(organization.id, documentId),
  })

  const saved = async (updated: DocumentDetail) => {
    queryClient.setQueryData(documentKeys.detail(organization.id, documentId), updated)
    await refresh()
  }

  const verify = useMutation({
    mutationFn: () => documentService.verify(organization.id, documentId),
    onSuccess: async (updated) => {
      await saved(updated)
      toast.success('Document verified.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const restore = useMutation({
    mutationFn: () => documentService.restore(organization.id, documentId),
    onSuccess: async (updated) => {
      await saved(updated)
      toast.success('Document restored.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const download = useMutation({
    mutationFn: (version: DocumentVersion) =>
      documentService.fileUrl(organization.id, documentId, version.id, 'attachment'),
    // The response is an attachment, so the browser saves it without leaving this page.
    onSuccess: (link) => window.location.assign(absoluteFileUrl(link.url)),
    onError: (error) => toast.error(errorMessage(error)),
  })

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
      <Link to={org.documents}>
        <ArrowLeft aria-hidden />
        Documents
      </Link>
    </Button>
  )

  if (query.isPending) return <PageLoader label="Loading document" />
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <>
        {back}
        <Card>
          {missing ? (
            <EmptyState
              icon={EyeOff}
              title="Document not found"
              description="It may have been removed, or the link may be wrong."
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      </>
    )
  }

  const document = query.data
  const archived = document.archived_at !== null
  const canWrite = can('documents:write') && !archived
  const canVerify = can('documents:verify') && !archived
  const phrase = expiryPhrase(document)

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <FileIcon version={document.current_version} className="size-5" />
            <h1 className="truncate text-xl font-semibold leading-7">{document.name}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge document={document} />
            <VerificationBadge status={document.verification_status} />
            <span className="text-[13px] text-muted-foreground">{categoryLabel(document.category)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {document.current_version && (
            <Button
              variant="outline"
              loading={download.isPending}
              onClick={() => document.current_version && download.mutate(document.current_version)}
            >
              <Download aria-hidden />
              Download
            </Button>
          )}
          {canWrite && (
            <>
              <Button variant="outline" onClick={() => setDialog('replace')}>
                <RefreshCw aria-hidden />
                Replace file
              </Button>
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil aria-hidden />
                Edit details
              </Button>
            </>
          )}
          {can('documents:delete') &&
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

      <ExtractionPanel document={document} />

      {archived && (
        <Notice variant="info" title="This document is archived" className="mb-6">
          It is hidden from the library and the dashboard and cannot be changed. Its files are kept.
        </Notice>
      )}
      {document.verification_status === 'rejected' && (
        <Notice variant="error" title="Rejected during review" className="mb-6">
          {document.rejection_reason}
          {document.verified_by_name && ` (${document.verified_by_name})`}
        </Notice>
      )}
      {canVerify && document.verification_status !== 'verified' && (
        <Notice
          variant="warning"
          title={document.verification_status === 'rejected' ? 'Review again' : 'Waiting for review'}
          className="mb-6"
          action={
            <div className="flex gap-2">
              {document.verification_status === 'pending' && (
                <Button variant="outline" size="sm" onClick={() => setDialog('reject')}>
                  <XCircle aria-hidden />
                  Reject
                </Button>
              )}
              <Button size="sm" loading={verify.isPending} onClick={() => verify.mutate()}>
                <CheckCircle2 aria-hidden />
                Verify
              </Button>
            </div>
          }
        >
          Check that the details below match the file, then verify the document.
        </Notice>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>File</CardTitle>
            {document.current_version && (
              <CardDescription>
                {document.current_version.original_filename} · {formatBytes(document.current_version.size_bytes)}
              </CardDescription>
            )}
          </CardHeader>
          <Preview organizationId={organization.id} document={document} />
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Field label="Expiry date">
                  {document.expiry_date ? (
                    <>
                      {formatDay(document.expiry_date)}
                      {phrase && <span className="block text-xs text-muted-foreground">{phrase}</span>}
                    </>
                  ) : (
                    'Does not expire'
                  )}
                </Field>
                <Field label="Issue date">{document.issue_date && formatDay(document.issue_date)}</Field>
                <Field label="Document number">{document.document_number}</Field>
                <Field label="Issuing authority">{document.issuing_authority}</Field>
                <Field label="Holder">{document.holder_name}</Field>
                <Field label="Belongs to">
                  {document.entity && (
                    <Link to={org.entity(document.entity.id)} className="font-medium text-brand hover:underline">
                      {document.entity.name}
                    </Link>
                  )}
                </Field>
                <Field label="Renewal owner">{document.owner?.full_name}</Field>
                <Field label="Review">
                  {document.verification_status === 'verified' && document.verified_at
                    ? `Verified by ${document.verified_by_name ?? 'a former member'} on ${formatDateTime(document.verified_at)}`
                    : document.verification_status === 'rejected'
                      ? 'Rejected'
                      : 'Not reviewed yet'}
                </Field>
                <Field label="Notes">
                  {document.notes && <span className="whitespace-pre-wrap">{document.notes}</span>}
                </Field>
                <Field label="Added">{formatDateTime(document.created_at)}</Field>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Version history</CardTitle>
              <CardDescription>Every file ever uploaded for this document. Nothing is deleted.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {document.versions.map((version, index) => (
                  <li key={version.id} className="flex items-start gap-3 py-3">
                    <FileIcon version={version} className="mt-0.5" />
                    <div className="min-w-0 flex-1 text-[13px]">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        Version {version.version_number}
                        {index === 0 && <Badge variant="brand">Current</Badge>}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {version.original_filename} · {formatBytes(version.size_bytes)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {version.uploaded_by_name ?? 'A former member'} · {formatDateTime(version.created_at)}
                      </p>
                      {version.note && <p className="mt-1 text-xs">{version.note}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download version ${version.version_number}`}
                      disabled={download.isPending}
                      onClick={() => download.mutate(version)}
                    >
                      <Download />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {dialog === 'edit' && (
        <EditDocumentDialog
          organizationId={organization.id}
          document={document}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog === 'replace' && (
        <ReplaceFileDialog
          organizationId={organization.id}
          document={document}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog === 'reject' && (
        <RejectDialog
          organizationId={organization.id}
          document={document}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onSaved={saved}
        />
      )}
      <ConfirmDialog
        open={dialog === 'archive'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Archive this document?"
        description="It disappears from the library, the dashboard and reminders. Its files are kept and you can restore it at any time."
        confirmLabel="Archive"
        onConfirm={async () => {
          await saved(await documentService.archive(organization.id, documentId))
          toast.success('Document archived.')
        }}
      />
    </>
  )
}
