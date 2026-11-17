import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RotateCw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Notice, Spinner } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
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
import { Input, Label } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { useOrganization } from '@/hooks/useOrganization'
import { ApiError, errorMessage } from '@/lib/http'
import { cn, formatDateTime } from '@/lib/utils'
import { documentKeys, documentService, entityKeys, entityService } from '@/services/documents'
import type { DocumentDetail, DocumentFields, ExtractedField, ExtractedKey, Extraction } from '@/types/api'

import { EntityPicker } from './controls'
import { formatDay, useOptions, useRefreshDocuments } from './shared'

/** The fields a person can take from the suggestions, in the order they are shown. */
const APPLICABLE: Array<{ key: Exclude<ExtractedKey, 'organization_mentioned'>; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Document type' },
  { key: 'document_number', label: 'Document number' },
  { key: 'issuing_authority', label: 'Issuing authority' },
  { key: 'holder_name', label: 'Holder' },
  { key: 'issue_date', label: 'Issue date' },
  { key: 'expiry_date', label: 'Expiry date' },
  { key: 'entity_id', label: 'Belongs to' },
]
type ApplicableKey = (typeof APPLICABLE)[number]['key']

const BUSY = new Set(['pending', 'processing'])
const READY = new Set(['extraction_completed', 'review_required'])

function currentValue(document: DocumentDetail, key: ApplicableKey): string {
  if (key === 'entity_id') return document.entity?.id ?? ''
  return document[key] ?? ''
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100)
  const variant = confidence >= 0.8 ? 'success' : confidence >= 0.5 ? 'warning' : 'destructive'
  const word = confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low'
  return (
    <Badge variant={variant} title={`Confidence ${percent}%`}>
      {word} · {percent}%
    </Badge>
  )
}

function useSuggestionLabels(organizationId: string) {
  const { categoryLabel } = useOptions()
  const lookup = useQuery({
    queryKey: entityKeys.lookup(organizationId),
    queryFn: () => entityService.lookup(organizationId),
  })
  return (key: ApplicableKey, value: string | null): string => {
    if (!value) return '–'
    if (key === 'category') return categoryLabel(value)
    if (key === 'issue_date' || key === 'expiry_date') return formatDay(value)
    if (key === 'entity_id') return lookup.data?.find((item) => item.id === value)?.name ?? 'A record'
    return value
  }
}

function sourceLine(extraction: Extraction): string {
  const by = extraction.provider_label ?? 'the reader'
  const source = extraction.text_source_label
  // "Text layer of the PDF" -> "text layer of the PDF": lower-case the first letter only.
  return source ? `Read by ${by} from the ${source.charAt(0).toLowerCase()}${source.slice(1).replace(/^the /i, '')}.` : `Read by ${by}.`
}

interface ReviewDialogProps {
  document: DocumentDetail
  extraction: Extraction
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Compare each suggestion with the current value and choose what to save. */
function ReviewDialog({ document, extraction, open, onOpenChange }: ReviewDialogProps) {
  const { organization, can } = useOrganization()
  const { categories } = useOptions()
  const label = useSuggestionLabels(organization.id)
  const queryClient = useQueryClient()
  const refresh = useRefreshDocuments(organization.id)

  const initial = () =>
    Object.fromEntries(
      APPLICABLE.map(({ key }) => [key, extraction.fields[key]?.value ?? currentValue(document, key)]),
    ) as Record<ApplicableKey, string>
  const [values, setValues] = useState<Record<ApplicableKey, string>>(initial)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<'save' | 'verify' | null>(null)

  const changed = APPLICABLE.filter(({ key }) => values[key] !== currentValue(document, key))

  const submit = async (verify: boolean) => {
    if (!values.name.trim()) {
      setFieldErrors({ name: 'Enter a name.' })
      return
    }
    setPending(verify ? 'verify' : 'save')
    setError(null)
    setFieldErrors({})
    const fields: Record<string, string | null> = {}
    for (const { key } of changed) {
      const value = values[key].trim()
      fields[key] = value === '' ? null : value
    }
    const body: DocumentFields & { verify: boolean } = { ...(fields as DocumentFields), verify }
    try {
      const updated = await documentService.applyExtraction(organization.id, document.id, body)
      queryClient.setQueryData(documentKeys.detail(organization.id, document.id), updated)
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: documentKeys.extraction(organization.id, document.id) }),
      ])
      toast.success(verify ? 'Details saved and document verified.' : 'Details saved.')
      onOpenChange(false)
    } catch (caught) {
      if (caught instanceof ApiError && caught.fieldErrors.length > 0) {
        setFieldErrors(Object.fromEntries(caught.fieldErrors.map((item) => [item.field, item.message])))
      }
      setError(errorMessage(caught))
    } finally {
      setPending(null)
    }
  }

  const set = (key: ApplicableKey, value: string) => setValues((current) => ({ ...current, [key]: value }))

  const control = (key: ApplicableKey, id: string) => {
    const common = { id, disabled: pending !== null, 'aria-invalid': Boolean(fieldErrors[key]) }
    switch (key) {
      case 'category':
        return (
          <NativeSelect {...common} value={values.category} onChange={(event) => set('category', event.target.value)}>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )
      case 'issue_date':
      case 'expiry_date':
        return <Input {...common} type="date" value={values[key]} onChange={(event) => set(key, event.target.value)} />
      case 'entity_id':
        return (
          <EntityPicker
            {...common}
            organizationId={organization.id}
            value={values.entity_id}
            onChange={(value) => set('entity_id', value)}
            emptyLabel="No one in particular"
          />
        )
      default:
        return <Input {...common} value={values[key]} onChange={(event) => set(key, event.target.value)} />
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => pending === null && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review suggested details</DialogTitle>
          <DialogDescription>
            Check each value against the file. Suggestions are filled in below; change anything that is wrong, or
            put back the current value. Only what you save changes the document.
          </DialogDescription>
        </DialogHeader>

        {extraction.warnings.length > 0 && (
          <Notice variant="warning" title="Check these carefully">
            <ul className="list-disc pl-4">
              {extraction.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Notice>
        )}
        {document.verification_status === 'verified' && (
          <Notice variant="info">
            This document is verified. Saving changed facts sends it back for review unless you verify it again.
          </Notice>
        )}
        {error && <Notice variant="error">{error}</Notice>}

        <div className="divide-y rounded-md border">
          {APPLICABLE.map(({ key, label: fieldLabel }) => {
            const suggestion: ExtractedField | undefined = extraction.fields[key]
            const current = currentValue(document, key)
            const id = `review-${key}`
            const isChanged = values[key] !== current
            return (
              <div key={key} className="grid gap-3 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                <div className="flex flex-col gap-1 pt-2">
                  <Label htmlFor={id}>{fieldLabel}</Label>
                  {isChanged && <span className="text-xs text-brand">Will change</span>}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  {control(key, id)}
                  {fieldErrors[key] && <p className="text-xs text-destructive">{fieldErrors[key]}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {suggestion?.value ? (
                      <>
                        <ConfidenceBadge confidence={suggestion.confidence} />
                        <span>Suggested: {label(key, suggestion.value)}</span>
                      </>
                    ) : (
                      <span>Nothing suggested</span>
                    )}
                    <span>Current: {label(key, current || null)}</span>
                    {isChanged && (
                      <button
                        type="button"
                        className="font-medium text-brand hover:underline"
                        onClick={() => set(key, current)}
                      >
                        Keep current
                      </button>
                    )}
                    {!isChanged && suggestion?.value && suggestion.value !== current && (
                      <button
                        type="button"
                        className="font-medium text-brand hover:underline"
                        onClick={() => set(key, suggestion.value ?? '')}
                      >
                        Use suggestion
                      </button>
                    )}
                  </div>
                  {suggestion?.note && <p className="text-xs text-warning">{suggestion.note}</p>}
                  {suggestion?.evidence && (
                    <p className="truncate text-xs italic text-muted-foreground" title={suggestion.evidence}>
                      “{suggestion.evidence}”
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {extraction.fields.organization_mentioned?.value && (
          <p className="text-xs text-muted-foreground">
            The document also mentions: {extraction.fields.organization_mentioned.value}
          </p>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {changed.length === 0 ? 'No changes yet.' : `${changed.length} ${changed.length === 1 ? 'field' : 'fields'} will change.`}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" disabled={pending !== null}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant={can('documents:verify') ? 'outline' : 'default'}
              loading={pending === 'save'}
              disabled={pending !== null}
              onClick={() => void submit(false)}
            >
              Save details
            </Button>
            {can('documents:verify') && (
              <Button loading={pending === 'verify'} disabled={pending !== null} onClick={() => void submit(true)}>
                Save and verify
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The suggestions read from the current file: progress, results, or the outcome of a review. */
export function ExtractionPanel({ document }: { document: DocumentDetail }) {
  const { organization, can } = useOrganization()
  const queryClient = useQueryClient()
  const label = useSuggestionLabels(organization.id)
  const [reviewing, setReviewing] = useState(false)
  const key = documentKeys.extraction(organization.id, document.id)
  const canWrite = can('documents:write') && document.archived_at === null

  const query = useQuery({
    queryKey: [...key, document.current_version?.id],
    queryFn: () => documentService.extraction(organization.id, document.id),
    // While the file is being read, check again every two seconds.
    refetchInterval: (state) => (state.state.data?.extraction && BUSY.has(state.state.data.extraction.status) ? 2000 : false),
  })

  const settle = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: documentKeys.all(organization.id) }),
      queryClient.invalidateQueries({ queryKey: documentKeys.dashboard(organization.id) }),
    ])
  }
  const retry = useMutation({
    mutationFn: () => documentService.retryExtraction(organization.id, document.id),
    onSuccess: settle,
    onError: (error) => toast.error(errorMessage(error)),
  })
  const dismiss = useMutation({
    mutationFn: () => documentService.dismissExtraction(organization.id, document.id),
    onSuccess: async () => {
      await settle()
      toast.success('Suggestions closed. The document is unchanged.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  if (query.isPending || query.isError) return null
  const { enabled, extraction } = query.data
  if (!extraction) {
    if (!enabled || !canWrite || !document.current_version) return null
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-[13px]">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-4" aria-hidden />
          This file has not been read automatically.
        </span>
        <Button variant="outline" size="sm" loading={retry.isPending} onClick={() => retry.mutate()}>
          Read file
        </Button>
      </div>
    )
  }

  if (BUSY.has(extraction.status)) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-[13px]" role="status">
        <Spinner />
        Reading the document to suggest its details…
      </div>
    )
  }

  if (extraction.status === 'failed') {
    return (
      <Notice
        variant="warning"
        title="The file could not be read automatically"
        className="mb-6"
        action={
          canWrite && (
            <Button variant="outline" size="sm" loading={retry.isPending} onClick={() => retry.mutate()}>
              <RotateCw aria-hidden />
              Try again
            </Button>
          )
        }
      >
        {extraction.error} You can always enter the details yourself with Edit details.
      </Notice>
    )
  }

  if (!READY.has(extraction.status)) {
    const applied = extraction.applied_fields.length
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-[13px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <Sparkles className="size-4" aria-hidden />
          {extraction.status === 'dismissed'
            ? 'Suggestions were closed without changes'
            : `Suggestions reviewed${applied ? `, ${applied} ${applied === 1 ? 'field' : 'fields'} saved` : ''}`}
          {extraction.reviewed_by_name && ` by ${extraction.reviewed_by_name}`}
          {extraction.reviewed_at && ` on ${formatDateTime(extraction.reviewed_at)}`}.
        </span>
        {canWrite && (
          <Button variant="ghost" size="sm" loading={retry.isPending} onClick={() => retry.mutate()}>
            <RotateCw aria-hidden />
            Read again
          </Button>
        )}
      </div>
    )
  }

  const found = APPLICABLE.filter(({ key: field }) => extraction.fields[field]?.value)
  return (
    <Card className="mb-6 border-brand/30">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" aria-hidden />
            Suggested details
            {extraction.status === 'review_required' && <Badge variant="warning">Needs a careful look</Badge>}
          </CardTitle>
          <CardDescription>
            {sourceLine(extraction)} Nothing changes until you review and save.
          </CardDescription>
        </div>
        {canWrite && (
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" loading={dismiss.isPending} onClick={() => dismiss.mutate()}>
              <X aria-hidden />
              Dismiss
            </Button>
            <Button size="sm" onClick={() => setReviewing(true)}>
              Review and apply
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {found.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No details could be found in this file. Enter them yourself with Edit details.
          </p>
        ) : (
          <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            {found.map(({ key: field, label: fieldLabel }) => {
              const suggestion = extraction.fields[field] as ExtractedField
              const same = suggestion.value === currentValue(document, field)
              return (
                <div key={field} className="flex items-center justify-between gap-3 border-b py-1.5">
                  <dt className="shrink-0 text-muted-foreground">{fieldLabel}</dt>
                  <dd className={cn('flex min-w-0 items-center gap-2', same && 'text-muted-foreground')}>
                    <span className="truncate" title={suggestion.value ?? ''}>
                      {label(field, suggestion.value)}
                    </span>
                    <ConfidenceBadge confidence={suggestion.confidence} />
                  </dd>
                </div>
              )
            })}
          </dl>
        )}
        {extraction.warnings.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-xs text-warning">
            {extraction.warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {warning}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {reviewing && (
        <ReviewDialog
          document={document}
          extraction={extraction}
          open
          onOpenChange={(open) => !open && setReviewing(false)}
        />
      )}
    </Card>
  )
}
