import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Play, RotateCcw, Send, Upload, XCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { FormField } from '@/components/shared/misc'
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DropZone, MemberPicker, Textarea } from '@/features/documents/controls'
import { fileProblem, FileIcon, formatBytes, formatDay, StatusBadge } from '@/features/documents/shared'
import { useOrganization } from '@/hooks/useOrganization'
import { ApiError, errorMessage } from '@/lib/http'
import { cn, formatDateTime } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { lifecycleKeys, renewalService } from '@/services/lifecycle'
import type { RenewalDetail } from '@/types/api'

import { deadlinePhrase, RENEWAL_STATUS, RenewalBadge, useRefreshRenewals } from './shared'

const STEPS = ['requested', 'in_progress', 'submitted', 'awaiting_approval', 'completed'] as const
const ACTION_LABELS: Record<string, string> = {
  created: 'Created the renewal',
  requested: 'Asked for the renewal',
  started: 'Started work',
  file_uploaded: 'Uploaded the renewed file',
  submitted: 'Sent for approval',
  approved: 'Approved the renewal',
  rejected: 'Rejected the renewal',
  reopened: 'Reopened the renewal',
  updated: 'Changed',
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted-foreground">–</span>}</dd>
    </div>
  )
}

function Progress({ renewal }: { renewal: RenewalDetail }) {
  const current = STEPS.indexOf(renewal.status as (typeof STEPS)[number])
  return (
    <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Renewal progress">
      {STEPS.map((step, index) => {
        const done = renewal.status === 'completed' || (current >= 0 && index < current)
        const active = index === current && renewal.status !== 'completed'
        return (
          <li key={step} className="flex flex-col gap-1.5" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'h-1.5 rounded-full',
                done ? 'bg-success' : active ? 'bg-brand' : renewal.status === 'rejected' ? 'bg-destructive/30' : 'bg-border',
              )}
            />
            <span className={cn('text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {RENEWAL_STATUS[step].label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function UploadDialog({ renewal, open, onOpenChange }: { renewal: RenewalDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { organization } = useOrganization()
  const queryClient = useQueryClient()
  const refresh = useRefreshRenewals(organization.id)
  const [file, setFile] = useState<File | null>(null)
  const [issueDate, setIssueDate] = useState(renewal.proposed_issue_date ?? '')
  const [expiryDate, setExpiryDate] = useState(renewal.proposed_expiry_date ?? '')
  const [note, setNote] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const busy = progress !== null

  const choose = (files: File[]) => {
    const chosen = files[0]
    if (!chosen) return
    const problem = fileProblem(chosen)
    setError(problem)
    setFile(problem ? null : chosen)
  }

  const submit = async () => {
    if (!file) return
    setError(null)
    setFieldErrors({})
    setProgress(0)
    try {
      const updated = await renewalService.uploadFile(
        organization.id,
        renewal.id,
        file,
        { issue_date: issueDate, expiry_date: expiryDate, note: note.trim() },
        setProgress,
      )
      queryClient.setQueryData(lifecycleKeys.renewal(organization.id, renewal.id), updated)
      await refresh()
      toast.success('Renewed file uploaded. Check the details, then send it for approval.')
      onOpenChange(false)
    } catch (caught) {
      if (caught instanceof ApiError && caught.fieldErrors.length > 0) {
        setFieldErrors(Object.fromEntries(caught.fieldErrors.map((item) => [item.field, item.message])))
      }
      setError(errorMessage(caught))
    } finally {
      setProgress(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload the renewed document</DialogTitle>
          <DialogDescription>
            The file is kept aside until the renewal is approved. Until then the current file stays in use.
          </DialogDescription>
        </DialogHeader>
        {error && <Notice variant="error">{error}</Notice>}
        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3.5 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
            </span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setFile(null)}>
              Change
            </Button>
          </div>
        ) : (
          <DropZone onFiles={choose} multiple={false} compact />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="New issue date" error={fieldErrors.issue_date} hint="Optional.">
            {(field) => (
              <Input {...field} type="date" disabled={busy} value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
            )}
          </FormField>
          <FormField
            label="New expiry date"
            error={fieldErrors.expiry_date}
            hint={renewal.previous_expiry_date ? `Currently ${formatDay(renewal.previous_expiry_date)}.` : undefined}
          >
            {(field) => (
              <Input {...field} type="date" disabled={busy} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
            )}
          </FormField>
          <FormField label="Note" hint="Optional." className="sm:col-span-2">
            {(field) => <Input {...field} maxLength={500} disabled={busy} value={note} onChange={(event) => setNote(event.target.value)} />}
          </FormField>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button loading={busy} disabled={!file} onClick={() => void submit()}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TextDialog({
  title,
  description,
  label,
  confirmLabel,
  required,
  destructive,
  open,
  onOpenChange,
  onConfirm,
}: {
  title: string
  description: string
  label: string
  confirmLabel: string
  required: boolean
  destructive?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (text: string) => Promise<unknown>
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (required && !text.trim()) {
      setError('This is required.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await onConfirm(text.trim())
      onOpenChange(false)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FormField label={label} error={error ?? undefined}>
          {(field) => <Textarea {...field} rows={3} maxLength={500} value={text} onChange={(event) => setText(event.target.value)} />}
        </FormField>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant={destructive ? 'destructive' : 'default'} loading={pending} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RenewalDetailPage() {
  const { renewalId = '' } = useParams()
  const { organization } = useOrganization()
  const org = paths.org(organization.slug)
  const queryClient = useQueryClient()
  const refresh = useRefreshRenewals(organization.id)
  const [dialog, setDialog] = useState<'upload' | 'submit' | 'approve' | 'reject' | null>(null)
  const key = lifecycleKeys.renewal(organization.id, renewalId)

  const query = useQuery({ queryKey: key, queryFn: () => renewalService.get(organization.id, renewalId) })

  const saved = async (updated: RenewalDetail, message: string) => {
    queryClient.setQueryData(key, updated)
    await refresh()
    toast.success(message)
  }
  const step = useMutation({
    mutationFn: (name: 'start' | 'request' | 'reopen') => renewalService.step(organization.id, renewalId, name),
    onSuccess: (updated, name) =>
      saved(updated, name === 'start' ? 'Renewal started.' : name === 'request' ? 'Renewal requested.' : 'Renewal reopened.'),
    onError: (error) => toast.error(errorMessage(error)),
  })
  const assign = useMutation({
    mutationFn: (membershipId: string) =>
      renewalService.update(organization.id, renewalId, { assignee_membership_id: membershipId || null }),
    onSuccess: (updated) => saved(updated, 'Assignee changed.'),
    onError: (error) => toast.error(errorMessage(error)),
  })

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
      <Link to={org.renewals}>
        <ArrowLeft aria-hidden />
        Renewals
      </Link>
    </Button>
  )

  if (query.isPending) return <PageLoader label="Loading renewal" />
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <>
        {back}
        <Card>
          {missing ? (
            <EmptyState icon={RotateCcw} title="Renewal not found" description="It may belong to another organization." />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      </>
    )
  }

  const renewal = query.data
  const can = renewal.can
  const phrase = renewal.status === 'completed' || renewal.status === 'rejected' ? null : deadlinePhrase(renewal.days_to_deadline)

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Renewal</p>
          <h1 className="truncate text-xl font-semibold leading-7">
            <Link to={org.document(renewal.document.id)} className="hover:text-brand">
              {renewal.document.name}
            </Link>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <RenewalBadge status={renewal.status} />
            {phrase && <span className={renewal.overdue ? 'text-destructive' : 'text-muted-foreground'}>{phrase}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can.request && renewal.status === 'not_started' && (
            <Button variant="outline" loading={step.isPending} disabled={!renewal.assignee} onClick={() => step.mutate('request')}>
              <Send aria-hidden />
              Request
            </Button>
          )}
          {can.start && (
            <Button variant="outline" loading={step.isPending} onClick={() => step.mutate('start')}>
              <Play aria-hidden />
              Start
            </Button>
          )}
          {can.upload && (
            <Button variant={renewal.new_version ? 'outline' : 'default'} onClick={() => setDialog('upload')}>
              <Upload aria-hidden />
              {renewal.new_version ? 'Replace renewed file' : 'Upload renewed file'}
            </Button>
          )}
          {can.submit && (
            <Button onClick={() => setDialog('submit')}>
              <Send aria-hidden />
              Send for approval
            </Button>
          )}
          {can.reject && (
            <Button variant="outline" onClick={() => setDialog('reject')}>
              <XCircle aria-hidden />
              Reject
            </Button>
          )}
          {can.approve && (
            <Button onClick={() => setDialog('approve')}>
              <CheckCircle2 aria-hidden />
              Approve
            </Button>
          )}
          {can.reopen && (
            <Button variant="outline" loading={step.isPending} onClick={() => step.mutate('reopen')}>
              <RotateCcw aria-hidden />
              Reopen
            </Button>
          )}
        </div>
      </div>

      {renewal.status !== 'rejected' && <Progress renewal={renewal} />}
      {renewal.status === 'rejected' && (
        <Notice variant="error" title="This renewal was rejected" className="mb-6">
          {renewal.rejection_reason}
        </Notice>
      )}
      {renewal.status === 'completed' && (
        <Notice variant="success" title="Renewal complete" className="mb-6">
          Approved by {renewal.completed_by_name ?? 'a former member'}
          {renewal.completed_at && ` on ${formatDateTime(renewal.completed_at)}`}. The renewed file is now the current
          version of the document.
        </Notice>
      )}
      {renewal.status === 'not_started' && !renewal.assignee && can.edit && (
        <Notice variant="info" className="mb-6">
          Assign someone below, then request the renewal so they are told about it.
        </Notice>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Renewed file</CardTitle>
              <CardDescription>
                {renewal.new_version
                  ? renewal.status === 'completed'
                    ? 'This file is now the current version.'
                    : 'Kept aside until the renewal is approved.'
                  : 'Nothing uploaded yet.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renewal.new_version ? (
                <div className="flex items-center gap-3 rounded-md border px-3.5 py-3 text-sm">
                  <FileIcon version={renewal.new_version} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{renewal.new_version.original_filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Version {renewal.new_version.version_number} · {formatBytes(renewal.new_version.size_bytes)} ·{' '}
                      {renewal.new_version.uploaded_by_name ?? 'A former member'}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={org.document(renewal.document.id)}>Open document</Link>
                  </Button>
                </div>
              ) : can.upload ? (
                <Button variant="outline" onClick={() => setDialog('upload')}>
                  <Upload aria-hidden />
                  Upload renewed file
                </Button>
              ) : null}
              <dl className="mt-3 divide-y">
                <Field label="Expiry before renewal">{renewal.previous_expiry_date && formatDay(renewal.previous_expiry_date)}</Field>
                <Field label="New expiry">
                  {renewal.proposed_expiry_date ? formatDay(renewal.proposed_expiry_date) : <span className="text-muted-foreground">Not given yet</span>}
                  {renewal.suggested_expiry_date && renewal.suggested_expiry_date !== renewal.proposed_expiry_date && (
                    <span className="block text-xs text-warning">
                      The file seems to say {formatDay(renewal.suggested_expiry_date)}. Check it before approving.
                    </span>
                  )}
                </Field>
                <Field label="New issue date">{renewal.proposed_issue_date && formatDay(renewal.proposed_issue_date)}</Field>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3.5">
                {[...renewal.events].reverse().map((event) => (
                  <li key={event.id} className="flex gap-3 text-[13px]">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p>
                        <span className="font-medium">{event.actor_name ?? 'A former member'}</span>{' '}
                        {(ACTION_LABELS[event.action] ?? event.action).replace(/^./, (c) => c.toLowerCase())}
                        {event.action === 'updated' && event.note ? ` the ${event.note}` : ''}
                      </p>
                      {event.note && event.action !== 'updated' && (
                        <p className="mt-0.5 text-muted-foreground">“{event.note}”</p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Field label="Document">
                <span className="flex flex-wrap items-center gap-2">
                  <Link to={org.document(renewal.document.id)} className="font-medium text-brand hover:underline">
                    {renewal.document.name}
                  </Link>
                  <StatusBadge document={renewal.document} />
                </span>
              </Field>
              <Field label="Assigned to">
                {can.edit ? (
                  <MemberPicker
                    organizationId={organization.id}
                    value={renewal.assignee?.membership_id ?? ''}
                    onChange={(value) => assign.mutate(value)}
                    disabled={assign.isPending}
                    aria-label="Assigned to"
                  />
                ) : (
                  renewal.assignee?.full_name
                )}
              </Field>
              <Field label="Deadline">{renewal.deadline && formatDay(renewal.deadline)}</Field>
              <Field label="Started by">{renewal.created_by_name}</Field>
              <Field label="Notes">{renewal.notes && <span className="whitespace-pre-wrap">{renewal.notes}</span>}</Field>
            </dl>
          </CardContent>
        </Card>
      </div>

      {dialog === 'upload' && <UploadDialog renewal={renewal} open onOpenChange={(open) => !open && setDialog(null)} />}
      <TextDialog
        open={dialog === 'submit'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Send for approval"
        description="An owner, admin or compliance manager checks the renewed file and approves it."
        label="Note for the approver (optional)"
        confirmLabel="Send for approval"
        required={false}
        onConfirm={async (note) => saved(await renewalService.step(organization.id, renewalId, 'submit', note), 'Sent for approval.')}
      />
      <TextDialog
        open={dialog === 'approve'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Approve this renewal?"
        description="The renewed file becomes the current version, the new dates apply, and the document is marked verified."
        label="Note (optional)"
        confirmLabel="Approve"
        required={false}
        onConfirm={async (note) => saved(await renewalService.step(organization.id, renewalId, 'approve', note), 'Renewal approved.')}
      />
      <TextDialog
        open={dialog === 'reject'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Reject this renewal?"
        description="The uploaded file is kept in the history but not used. The assignee is told why."
        label="Reason"
        confirmLabel="Reject"
        required
        destructive
        onConfirm={async (reason) => saved(await renewalService.reject(organization.id, renewalId, reason), 'Renewal rejected.')}
      />
    </>
  )
}
