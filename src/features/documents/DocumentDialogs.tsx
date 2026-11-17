import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormField } from '@/components/shared/misc'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
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
import { NativeSelect } from '@/components/ui/select'
import { applyFieldErrors } from '@/features/auth/schemas'
import { errorMessage } from '@/lib/http'
import { documentService } from '@/services/documents'
import type { DocumentDetail, DocumentFields } from '@/types/api'

import { DropZone, EntityPicker, MemberPicker, Textarea } from './controls'
import { fileProblem, formatBytes, useOptions } from './shared'

const detailsSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(255, 'Use at most 255 characters'),
    category: z.string().min(1, 'Choose a document type'),
    document_number: z.string().max(100, 'Use at most 100 characters'),
    issuing_authority: z.string().max(200, 'Use at most 200 characters'),
    holder_name: z.string().max(200, 'Use at most 200 characters'),
    issue_date: z.string(),
    expiry_date: z.string(),
    entity_id: z.string(),
    owner_membership_id: z.string(),
    notes: z.string().max(5000, 'Use at most 5000 characters'),
  })
  .refine((values) => !values.issue_date || !values.expiry_date || values.expiry_date >= values.issue_date, {
    path: ['expiry_date'],
    message: 'The expiry date cannot be before the issue date',
  })
type DetailsValues = z.infer<typeof detailsSchema>

const DETAIL_FIELDS = [
  'name',
  'category',
  'document_number',
  'issuing_authority',
  'holder_name',
  'issue_date',
  'expiry_date',
  'entity_id',
  'owner_membership_id',
  'notes',
] as const

function toValues(document: DocumentDetail): DetailsValues {
  return {
    name: document.name,
    category: document.category,
    document_number: document.document_number ?? '',
    issuing_authority: document.issuing_authority ?? '',
    holder_name: document.holder_name ?? '',
    issue_date: document.issue_date ?? '',
    expiry_date: document.expiry_date ?? '',
    entity_id: document.entity?.id ?? '',
    owner_membership_id: document.owner?.membership_id ?? '',
    notes: document.notes ?? '',
  }
}

function toFields(values: DetailsValues): DocumentFields {
  const orNull = (value: string) => value.trim() || null
  return {
    name: values.name.trim(),
    category: values.category,
    document_number: orNull(values.document_number),
    issuing_authority: orNull(values.issuing_authority),
    holder_name: orNull(values.holder_name),
    issue_date: values.issue_date || null,
    expiry_date: values.expiry_date || null,
    entity_id: values.entity_id || null,
    owner_membership_id: values.owner_membership_id || null,
    notes: orNull(values.notes),
  }
}

interface DialogProps {
  organizationId: string
  document: DocumentDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the updated document after a successful change. */
  onSaved: (document: DocumentDetail) => Promise<unknown>
}

export function EditDocumentDialog({ organizationId, document, open, onOpenChange, onSaved }: DialogProps) {
  const { categories } = useOptions()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), defaultValues: toValues(document) })

  const change = (next: boolean) => {
    if (next) {
      reset(toValues(document))
      setFormError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const updated = await documentService.update(organizationId, document.id, toFields(values))
      await onSaved(updated)
      toast.success('Document details saved.')
      onOpenChange(false)
    } catch (error) {
      if (!applyFieldErrors(error, setError, DETAIL_FIELDS)) setFormError(errorMessage(error))
    }
  })

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>
            {document.verification_status === 'verified'
              ? 'Changing the type, number, issuer, holder or dates sends this document back for review.'
              : 'The facts recorded about this document.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" error={errors.name?.message} className="sm:col-span-2">
              {(field) => <Input maxLength={255} {...field} {...register('name')} />}
            </FormField>
            <FormField label="Document type" error={errors.category?.message}>
              {(field) => (
                <NativeSelect {...field} {...register('category')}>
                  {categories.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label="Document number" error={errors.document_number?.message}>
              {(field) => <Input {...field} {...register('document_number')} />}
            </FormField>
            <FormField label="Issuing authority" error={errors.issuing_authority?.message}>
              {(field) => <Input {...field} {...register('issuing_authority')} />}
            </FormField>
            <FormField label="Holder" error={errors.holder_name?.message} hint="The person or company it was issued to.">
              {(field) => <Input {...field} {...register('holder_name')} />}
            </FormField>
            <FormField label="Issue date" error={errors.issue_date?.message}>
              {(field) => <Input type="date" {...field} {...register('issue_date')} />}
            </FormField>
            <FormField label="Expiry date" error={errors.expiry_date?.message} hint="Leave empty if it does not expire.">
              {(field) => <Input type="date" {...field} {...register('expiry_date')} />}
            </FormField>
            <FormField label="Belongs to" error={errors.entity_id?.message}>
              {(field) => (
                <Controller
                  control={control}
                  name="entity_id"
                  render={({ field: controller }) => (
                    <EntityPicker
                      {...field}
                      organizationId={organizationId}
                      value={controller.value}
                      onChange={controller.onChange}
                      onBlur={controller.onBlur}
                      emptyLabel="No one in particular"
                    />
                  )}
                />
              )}
            </FormField>
            <FormField
              label="Renewal owner"
              error={errors.owner_membership_id?.message}
              hint="The person responsible for keeping it current."
            >
              {(field) => (
                <Controller
                  control={control}
                  name="owner_membership_id"
                  render={({ field: controller }) => (
                    <MemberPicker
                      {...field}
                      organizationId={organizationId}
                      value={controller.value}
                      onChange={controller.onChange}
                      onBlur={controller.onBlur}
                    />
                  )}
                />
              )}
            </FormField>
            <FormField label="Notes" error={errors.notes?.message} className="sm:col-span-2">
              {(field) => <Textarea rows={3} {...field} {...register('notes')} />}
            </FormField>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={isSubmitting}>
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Upload a new file for a document. The current file moves into the version history. */
export function ReplaceFileDialog({ organizationId, document, open, onOpenChange, onSaved }: DialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [note, setNote] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = progress !== null

  const change = (next: boolean) => {
    if (busy) return
    if (next) {
      setFile(null)
      setExpiryDate('')
      setIssueDate('')
      setNote('')
      setError(null)
    }
    onOpenChange(next)
  }

  const choose = (files: File[]) => {
    const chosen = files[0]
    if (!chosen) return
    const problem = fileProblem(chosen)
    setError(problem)
    setFile(problem ? null : chosen)
  }

  const submit = async () => {
    if (!file) return
    if (issueDate && expiryDate && expiryDate < issueDate) {
      setError('The expiry date cannot be before the issue date.')
      return
    }
    setError(null)
    setProgress(0)
    try {
      const updated = await documentService.replaceFile(
        organizationId,
        document.id,
        file,
        { issue_date: issueDate, expiry_date: expiryDate, note: note.trim() },
        setProgress,
      )
      await onSaved(updated)
      toast.success(`Version ${updated.current_version?.version_number ?? ''} uploaded.`)
      setProgress(null)
      onOpenChange(false)
    } catch (caught) {
      setProgress(null)
      setError(errorMessage(caught))
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace file</DialogTitle>
          <DialogDescription>
            Upload the renewed or corrected file. The current file stays in the version history, and the
            document goes back for review.
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
          <FormField label="New issue date" hint="Optional.">
            {(field) => (
              <Input
                type="date"
                disabled={busy}
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
                {...field}
              />
            )}
          </FormField>
          <FormField label="New expiry date" hint="Leave empty to keep the current date.">
            {(field) => (
              <Input
                type="date"
                disabled={busy}
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
                {...field}
              />
            )}
          </FormField>
          <FormField label="Note" hint="Optional. Shown in the version history." className="sm:col-span-2">
            {(field) => (
              <Input
                maxLength={500}
                disabled={busy}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                {...field}
              />
            )}
          </FormField>
        </div>
        {busy && (
          <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round((progress ?? 0) * 100)}>
            <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button loading={busy} disabled={!file} onClick={() => void submit()}>
            Upload new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RejectDialog({ organizationId, document, open, onOpenChange, onSaved }: DialogProps) {
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = (next: boolean) => {
    if (pending) return
    if (next) {
      setReason('')
      setError(null)
    }
    onOpenChange(next)
  }

  const submit = async () => {
    if (!reason.trim()) {
      setError('Say what is wrong, so that the person who uploaded it can fix it.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const updated = await documentService.reject(organizationId, document.id, reason.trim())
      await onSaved(updated)
      toast.success('Document rejected.')
      onOpenChange(false)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this document</DialogTitle>
          <DialogDescription>
            The reason is shown on the document and recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Reason" error={error ?? undefined}>
          {(field) => (
            <Textarea
              rows={3}
              maxLength={500}
              autoFocus
              placeholder="For example: the scan is unreadable, or the expiry date does not match the file."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              {...field}
            />
          )}
        </FormField>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" loading={pending} onClick={() => void submit()}>
            Reject document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
