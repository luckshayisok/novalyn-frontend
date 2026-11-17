/* Presentation helpers shared by the document and entity screens. */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building,
  Building2,
  FileImage,
  FileText,
  FileType2,
  Forklift,
  MapPin,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useCallback } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { documentKeys, entityKeys } from '@/services/documents'
import { organizationService, queryKeys } from '@/services/organizations'
import type { DocumentSummary, DocumentVersion, EntityType, Option, VerificationStatus } from '@/types/api'

export const MAX_UPLOAD_MB = 25
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.jpg', '.jpeg', '.png']
export const ACCEPTED_LABEL = 'PDF, DOCX, JPG or PNG, up to 25 MB each'

/** Why a file cannot be uploaded, or null when it looks acceptable. The server checks again. */
export function fileProblem(file: File): string | null {
  const dot = file.name.lastIndexOf('.')
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  if (!ACCEPTED_EXTENSIONS.includes(extension)) return 'Only PDF, DOCX, JPG and PNG files can be uploaded.'
  if (file.size === 0) return 'This file is empty.'
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Files can be at most ${MAX_UPLOAD_MB} MB.`
  return null
}

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short' })

/** Format a calendar date (`YYYY-MM-DD`) without shifting it across time zones. */
export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return dayFormat.format(new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1))
}

/** `2026-12` to "Dec ’26", which cannot be mistaken for a day of the month. */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const name = monthFormat.format(new Date(year ?? 1970, (month ?? 1) - 1, 1))
  return `${name} ’${String(year ?? 1970).slice(-2)}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** "Expires in 12 days", "Expired 3 days ago", "Expires today". */
export function expiryPhrase(document: Pick<DocumentSummary, 'days_until_expiry'>): string | null {
  const days = document.days_until_expiry
  if (days === null) return null
  if (days < 0) return `Expired ${plural(-days, 'day')} ago`
  if (days === 0) return 'Expires today'
  return `Expires in ${plural(days, 'day')}`
}

export function StatusBadge({ document }: { document: DocumentSummary }) {
  switch (document.status) {
    case 'archived':
      return <Badge variant="neutral">Archived</Badge>
    case 'expired':
      return <Badge variant="destructive">Expired</Badge>
    case 'expiring_soon':
      return <Badge variant="warning">Expiring soon</Badge>
    default:
      return document.expiry_date ? <Badge variant="success">Valid</Badge> : <Badge variant="outline">No expiry</Badge>
  }
}

const VERIFICATION: Record<VerificationStatus, { label: string; variant: 'success' | 'neutral' | 'destructive' }> = {
  verified: { label: 'Verified', variant: 'success' },
  pending: { label: 'Pending review', variant: 'neutral' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { label, variant } = VERIFICATION[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function FileIcon({ version, className }: { version: DocumentVersion | null; className?: string }) {
  const type = version?.content_type ?? ''
  const Icon = type.startsWith('image/') ? FileImage : type === 'application/pdf' ? FileText : FileType2
  return <Icon className={cn('size-4 shrink-0 text-muted-foreground', className)} aria-hidden />
}

export const ENTITY_TYPE_LABELS: Record<EntityType, { singular: string; plural: string; icon: LucideIcon }> = {
  employee: { singular: 'Employee', plural: 'Employees', icon: UserRound },
  supplier: { singular: 'Supplier', plural: 'Suppliers', icon: Building2 },
  equipment: { singular: 'Equipment', plural: 'Equipment', icon: Forklift },
  location: { singular: 'Location', plural: 'Locations', icon: MapPin },
  department: { singular: 'Department', plural: 'Departments', icon: Building },
}
export const ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS) as EntityType[]

export function EntityTypeBadge({ type }: { type: EntityType }) {
  return <Badge variant="outline">{ENTITY_TYPE_LABELS[type].singular}</Badge>
}

/** Document categories and other reference lists, with a label lookup. */
export function useOptions() {
  const query = useQuery({ queryKey: queryKeys.options, queryFn: organizationService.options, staleTime: Infinity })
  const categories: Option[] = query.data?.document_categories ?? []
  const categoryLabel = useCallback(
    (value: string) => query.data?.document_categories.find((item) => item.value === value)?.label ?? value,
    [query.data],
  )
  return { ...query, categories, categoryLabel }
}

/** Refresh everything that shows documents: lists, details, dashboard, entity counts, audit log. */
export function useRefreshDocuments(organizationId: string) {
  const queryClient = useQueryClient()
  return useCallback(
    () =>
      Promise.all(
        [
          documentKeys.all(organizationId),
          documentKeys.dashboard(organizationId),
          entityKeys.all(organizationId),
          queryKeys.auditLogs(organizationId),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
    [queryClient, organizationId],
  )
}

interface DocumentTableProps {
  documents: DocumentSummary[]
  organizationSlug: string
  categoryLabel: (value: string) => string
  /** Hide the "Belongs to" column, for example on a record's own page. */
  hideEntity?: boolean
}

export function DocumentTable({ documents, organizationSlug, categoryLabel, hideEntity = false }: DocumentTableProps) {
  const org = paths.org(organizationSlug)
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-5">Document</TableHead>
          <TableHead>Type</TableHead>
          {!hideEntity && <TableHead>Belongs to</TableHead>}
          <TableHead>Expiry</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="pr-5">Review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document.id}>
            <TableCell className="max-w-[320px] pl-5">
              <Link
                to={org.document(document.id)}
                className="group flex items-center gap-2.5 rounded-sm font-medium hover:text-brand"
              >
                <FileIcon version={document.current_version} />
                <span className="truncate">{document.name}</span>
              </Link>
              {document.document_number && (
                <p className="ml-[26px] truncate text-xs text-muted-foreground">No. {document.document_number}</p>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {categoryLabel(document.category)}
            </TableCell>
            {!hideEntity && (
              <TableCell className="max-w-[200px]">
                {document.entity ? (
                  <Link to={org.entity(document.entity.id)} className="block truncate rounded-sm hover:text-brand">
                    {document.entity.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </TableCell>
            )}
            <TableCell className="whitespace-nowrap">
              {document.expiry_date ? (
                <>
                  <span className="tabular-nums">{formatDay(document.expiry_date)}</span>
                  {document.status !== 'valid' && document.status !== 'archived' && (
                    <span
                      className={cn(
                        'block text-xs',
                        document.status === 'expired' ? 'text-destructive' : 'text-warning',
                      )}
                    >
                      {expiryPhrase(document)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">–</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge document={document} />
            </TableCell>
            <TableCell className="pr-5">
              <VerificationBadge status={document.verification_status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function NoDocuments({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <EmptyState icon={FileText} title={title} description={description} action={action} />
}
