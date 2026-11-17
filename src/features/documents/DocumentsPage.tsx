import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/shared/misc'
import { ErrorState } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/select'
import { useOrganization } from '@/hooks/useOrganization'
import { paths } from '@/routes/paths'
import { documentKeys, documentService } from '@/services/documents'
import type { DocumentListParams, VerificationStatus } from '@/types/api'

import { Pagination, SearchInput } from './controls'
import { DocumentTable, NoDocuments, useOptions } from './shared'

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'valid', label: 'Valid' },
  { value: 'expiring_soon', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
] as const

const REVIEW_OPTIONS = [
  { value: '', label: 'Any review state' },
  { value: 'pending', label: 'Pending review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
] as const

const SORT_OPTIONS = [
  { value: 'expiry_date', label: 'Expiry: soonest first' },
  { value: '-expiry_date', label: 'Expiry: latest first' },
  { value: 'name', label: 'Name: A to Z' },
  { value: '-name', label: 'Name: Z to A' },
  { value: '-created_at', label: 'Newest uploads' },
  { value: '-updated_at', label: 'Recently changed' },
] as const

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((item) => item === value)
}

/** The document library: every document in the organization, with search, filters and sorting. */
export function DocumentsPage() {
  const { organization, can } = useOrganization()
  const org = paths.org(organization.slug)
  const { categories, categoryLabel } = useOptions()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filters live in the URL so that a filtered view can be linked to and survives a reload.
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const status = oneOf(searchParams.get('status'), ['valid', 'expiring_soon', 'expired', 'archived'] as const) ?? ''
  const verification = oneOf(searchParams.get('review'), ['pending', 'verified', 'rejected'] as const) ?? ''
  const sort = oneOf(searchParams.get('sort'), SORT_OPTIONS.map((item) => item.value)) ?? 'expiry_date'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const hasFilters = Boolean(q || category || status || verification)

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const params: DocumentListParams = {
    q: q || undefined,
    category: category || undefined,
    status: status && status !== 'archived' ? status : undefined,
    archived: status === 'archived',
    verification: (verification || undefined) as VerificationStatus | undefined,
    sort,
    page,
    page_size: PAGE_SIZE,
  }
  const documents = useQuery({
    queryKey: documentKeys.list(organization.id, params),
    queryFn: () => documentService.list(organization.id, params),
    placeholderData: keepPreviousData,
  })

  const uploadButton = can('documents:write') && (
    <Button asChild>
      <Link to={org.upload}>
        <Upload aria-hidden />
        Upload documents
      </Link>
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every license, certificate, policy and permit your organization keeps on file."
        actions={uploadButton}
      />

      <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <SearchInput
          key={q}
          value={q}
          onChange={(value) => setFilter('q', value.trim())}
          placeholder="Search name, number or issuer"
          label="Search documents"
        />
        <NativeSelect
          aria-label="Document type"
          value={category}
          onChange={(event) => setFilter('category', event.target.value)}
        >
          <option value="">All types</option>
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Status" value={status} onChange={(event) => setFilter('status', event.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Review state"
          value={verification}
          onChange={(event) => setFilter('review', event.target.value)}
        >
          {REVIEW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Sort by" value={sort} onChange={(event) => setFilter('sort', event.target.value)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Card className={documents.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}>
        {documents.isPending ? (
          <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading documents">
            {Array.from({ length: 6 }, (_, row) => (
              <Skeleton key={row} className="h-8" />
            ))}
          </div>
        ) : documents.isError ? (
          <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
        ) : documents.data.items.length === 0 ? (
          hasFilters ? (
            <NoDocuments
              title="No documents match these filters"
              description="Try a different search, or clear the filters to see everything."
              action={
                <Button variant="outline" onClick={() => setSearchParams({}, { replace: true })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <NoDocuments
              title="No documents yet"
              description="Upload your first document to start tracking its expiry date."
              action={uploadButton || undefined}
            />
          )
        ) : (
          <>
            <DocumentTable
              documents={documents.data.items}
              organizationSlug={organization.slug}
              categoryLabel={categoryLabel}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={documents.data.total}
              busy={documents.isFetching}
              onPageChange={(next) => setFilter('page', next > 1 ? String(next) : '')}
            />
          </>
        )}
      </Card>
    </>
  )
}
