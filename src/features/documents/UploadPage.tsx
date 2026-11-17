import { AlertCircle, ArrowLeft, CheckCircle2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/shared/misc'
import { Notice, Spinner } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { RequirePermission } from '@/routes/guards'
import { useOrganization } from '@/hooks/useOrganization'
import { errorMessage } from '@/lib/http'
import { paths } from '@/routes/paths'
import { documentService } from '@/services/documents'

import { DropZone, EntityPicker } from './controls'
import { fileProblem, formatBytes, useOptions, useRefreshDocuments } from './shared'

type ItemState = 'ready' | 'uploading' | 'done' | 'error' | 'invalid'

interface UploadItem {
  key: string
  file: File
  name: string
  category: string
  expiryDate: string
  state: ItemState
  progress: number
  error: string | null
  documentId: string | null
}

let nextKey = 0

function stem(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

function UploadCenter() {
  const { organization } = useOrganization()
  const org = paths.org(organization.slug)
  const { categories } = useOptions()
  const refresh = useRefreshDocuments(organization.id)
  const [searchParams] = useSearchParams()

  const [items, setItems] = useState<UploadItem[]>([])
  const [entityId, setEntityId] = useState(searchParams.get('entity') ?? '')
  const [defaultCategory, setDefaultCategory] = useState('')
  const [running, setRunning] = useState(false)

  const patch = (key: string, changes: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)))

  const addFiles = (files: File[]) => {
    setItems((current) => [
      ...current,
      ...files.map((file): UploadItem => {
        const problem = fileProblem(file)
        return {
          key: `file-${nextKey++}`,
          file,
          name: stem(file.name),
          category: defaultCategory,
          expiryDate: '',
          state: problem ? 'invalid' : 'ready',
          progress: 0,
          error: problem,
          documentId: null,
        }
      }),
    ])
  }

  const applyDefaultCategory = (value: string) => {
    setDefaultCategory(value)
    // Fill in rows that have no type yet; rows the user already set are left alone.
    setItems((current) =>
      current.map((item) => (item.state === 'ready' && !item.category ? { ...item, category: value } : item)),
    )
  }

  const waiting = items.filter((item) => item.state === 'ready' || item.state === 'error')
  const missingType = waiting.some((item) => !item.category)
  const done = items.filter((item) => item.state === 'done').length

  const uploadAll = async () => {
    setRunning(true)
    for (const item of waiting) {
      if (!item.name.trim() || !item.category) continue
      patch(item.key, { state: 'uploading', progress: 0, error: null })
      try {
        const document = await documentService.upload(
          organization.id,
          item.file,
          {
            name: item.name.trim(),
            category: item.category,
            expiry_date: item.expiryDate || undefined,
            entity_id: entityId || undefined,
          },
          (fraction) => patch(item.key, { progress: fraction }),
        )
        patch(item.key, { state: 'done', progress: 1, documentId: document.id })
      } catch (error) {
        patch(item.key, { state: 'error', error: errorMessage(error) })
      }
    }
    await refresh()
    setRunning(false)
  }

  return (
    <>
      <PageHeader
        title="Upload documents"
        description="Add files, set the type and expiry date for each, then upload them together."
        actions={
          <Button asChild variant="outline">
            <Link to={org.documents}>
              <ArrowLeft aria-hidden />
              Back to documents
            </Link>
          </Button>
        }
      />

      <DropZone onFiles={addFiles} disabled={running} />

      {items.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>
                {items.length} {items.length === 1 ? 'file' : 'files'}
              </CardTitle>
              <CardDescription>You can fill in the remaining details on each document afterwards.</CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="default-type">Type for all files</Label>
                <NativeSelect
                  id="default-type"
                  className="sm:w-56"
                  value={defaultCategory}
                  disabled={running}
                  onChange={(event) => applyDefaultCategory(event.target.value)}
                >
                  <option value="">Choose per file</option>
                  {categories.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="belongs-to">Belongs to</Label>
                <EntityPicker
                  id="belongs-to"
                  className="sm:w-56"
                  organizationId={organization.id}
                  value={entityId}
                  onChange={setEntityId}
                  disabled={running}
                  emptyLabel="No one in particular"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ul className="divide-y border-t">
              {items.map((item) => {
                const editable = item.state === 'ready' || item.state === 'error'
                return (
                  <li key={item.key} className="px-5 py-4">
                    <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_170px_auto]">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Input
                          aria-label={`Name for ${item.file.name}`}
                          value={item.name}
                          maxLength={255}
                          disabled={!editable || running}
                          aria-invalid={editable && !item.name.trim()}
                          onChange={(event) => patch(item.key, { name: event.target.value })}
                        />
                        <p className="truncate text-xs text-muted-foreground">
                          {item.file.name} · {formatBytes(item.file.size)}
                        </p>
                      </div>
                      <NativeSelect
                        aria-label={`Type of ${item.file.name}`}
                        value={item.category}
                        disabled={!editable || running}
                        aria-invalid={editable && !item.category}
                        onChange={(event) => patch(item.key, { category: event.target.value })}
                      >
                        <option value="">Choose a type</option>
                        {categories.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </NativeSelect>
                      <Input
                        type="date"
                        aria-label={`Expiry date of ${item.file.name}`}
                        title="Expiry date (optional)"
                        value={item.expiryDate}
                        disabled={!editable || running}
                        onChange={(event) => patch(item.key, { expiryDate: event.target.value })}
                      />
                      <div className="flex h-9 items-center justify-end gap-2">
                        {item.state === 'uploading' && (
                          <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                            <Spinner />
                            {Math.round(item.progress * 100)}%
                          </span>
                        )}
                        {item.state === 'done' && item.documentId && (
                          <Button asChild variant="ghost" size="sm" className="text-success">
                            <Link to={org.document(item.documentId)}>
                              <CheckCircle2 aria-hidden />
                              Open
                            </Link>
                          </Button>
                        )}
                        {(editable || item.state === 'invalid') && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={running}
                            aria-label={`Remove ${item.file.name}`}
                            onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}
                          >
                            <X />
                          </Button>
                        )}
                      </div>
                    </div>
                    {item.state === 'uploading' && (
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div
                          className="h-full bg-brand transition-[width]"
                          style={{ width: `${Math.round(item.progress * 100)}%` }}
                        />
                      </div>
                    )}
                    {item.error && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive" role="alert">
                        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                        {item.error}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3">
            <p className="text-[13px] text-muted-foreground">
              {missingType
                ? 'Choose a type for every file to upload it.'
                : done > 0
                  ? `${done} of ${items.length} uploaded.`
                  : 'Expiry dates are optional and can be added later.'}
            </p>
            <div className="flex items-center gap-2">
              {done > 0 && waiting.length === 0 && (
                <Button asChild variant="outline">
                  <Link to={org.documents}>View documents</Link>
                </Button>
              )}
              <Button
                loading={running}
                disabled={waiting.length === 0 || missingType || waiting.some((item) => !item.name.trim())}
                onClick={() => void uploadAll()}
              >
                {waiting.length > 0
                  ? `Upload ${waiting.length} ${waiting.length === 1 ? 'file' : 'files'}`
                  : 'Nothing to upload'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {items.length === 0 && (
        <Notice variant="info" className="mt-6">
          Files are checked when they arrive: the content has to match the file type, and each file can be up
          to 25 MB.
        </Notice>
      )}
    </>
  )
}

export function UploadPage() {
  return (
    <RequirePermission permission="documents:write">
      <UploadCenter />
    </RequirePermission>
  )
}
