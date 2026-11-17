import { api, upload } from '@/lib/http'
import type {
  Dashboard,
  DocumentDetail,
  DocumentFields,
  DocumentListParams,
  DocumentSummary,
  ExtractionState,
  Entity,
  EntityFields,
  EntityRef,
  EntityType,
  EntityTypeCount,
  FileUrl,
  Page,
  SearchResults,
} from '@/types/api'

const org = (organizationId: string) => `/organizations/${organizationId}`

/** Build the multipart body for an upload: the file plus any non-empty fields. */
function formData(file: File, fields: Record<string, string | null | undefined>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined && value !== '') form.append(key, value)
  }
  form.append('file', file)
  return form
}

/** The API serves file links from its own origin; with a same-origin API the path is used as is. */
export function absoluteFileUrl(path: string): string {
  const base: string | undefined = import.meta.env.VITE_API_URL
  if (base && /^https?:\/\//.test(base)) return new URL(path, base).toString()
  return path
}

export const documentService = {
  list: (organizationId: string, params: DocumentListParams) =>
    api<Page<DocumentSummary>>(`${org(organizationId)}/documents`, {
      query: {
        ...params,
        archived: params.archived ? 'true' : undefined,
        suggestions: params.suggestions ? 'true' : undefined,
      },
    }),

  get: (organizationId: string, documentId: string) =>
    api<DocumentDetail>(`${org(organizationId)}/documents/${documentId}`),

  upload: (
    organizationId: string,
    file: File,
    fields: DocumentFields & { category: string },
    onProgress?: (fraction: number) => void,
  ) => upload<DocumentDetail>(`${org(organizationId)}/documents`, formData(file, { ...fields }), onProgress),

  update: (organizationId: string, documentId: string, changes: DocumentFields) =>
    api<DocumentDetail>(`${org(organizationId)}/documents/${documentId}`, { method: 'PATCH', body: changes }),

  replaceFile: (
    organizationId: string,
    documentId: string,
    file: File,
    fields: { issue_date?: string; expiry_date?: string; note?: string },
    onProgress?: (fraction: number) => void,
  ) =>
    upload<DocumentDetail>(
      `${org(organizationId)}/documents/${documentId}/versions`,
      formData(file, fields),
      onProgress,
    ),

  fileUrl: (organizationId: string, documentId: string, versionId: string, disposition: 'inline' | 'attachment') =>
    api<FileUrl>(`${org(organizationId)}/documents/${documentId}/versions/${versionId}/file-url`, {
      method: 'POST',
      body: { disposition },
    }),

  verify: (organizationId: string, documentId: string) =>
    api<DocumentDetail>(`${org(organizationId)}/documents/${documentId}/verify`, { method: 'POST' }),

  reject: (organizationId: string, documentId: string, reason: string) =>
    api<DocumentDetail>(`${org(organizationId)}/documents/${documentId}/reject`, {
      method: 'POST',
      body: { reason },
    }),

  archive: (organizationId: string, documentId: string) =>
    api<DocumentDetail>(`${org(organizationId)}/documents/${documentId}/archive`, { method: 'POST' }),

  restore: (organizationId: string, documentId: string) =>
    api<DocumentDetail>(`${org(organizationId)}/documents/${documentId}/restore`, { method: 'POST' }),

  extraction: (organizationId: string, documentId: string) =>
    api<ExtractionState>(`${org(organizationId)}/documents/${documentId}/extraction`),

  retryExtraction: (organizationId: string, documentId: string) =>
    api<ExtractionState>(`${org(organizationId)}/documents/${documentId}/extraction/retry`, { method: 'POST' }),

  applyExtraction: (organizationId: string, documentId: string, values: DocumentFields & { verify: boolean }) =>
    api<DocumentDetail>(`${org(organizationId)}/documents/${documentId}/extraction/apply`, {
      method: 'POST',
      body: values,
    }),

  dismissExtraction: (organizationId: string, documentId: string) =>
    api<ExtractionState>(`${org(organizationId)}/documents/${documentId}/extraction/dismiss`, { method: 'POST' }),
}

export const entityService = {
  list: (
    organizationId: string,
    params: { type?: EntityType; q?: string; archived?: boolean; page?: number; page_size?: number },
  ) =>
    api<Page<Entity>>(`${org(organizationId)}/entities`, {
      query: { ...params, archived: params.archived ? 'true' : undefined },
    }),

  lookup: (organizationId: string, params: { type?: EntityType; q?: string } = {}) =>
    api<EntityRef[]>(`${org(organizationId)}/entities/lookup`, { query: params }),

  counts: (organizationId: string) => api<EntityTypeCount[]>(`${org(organizationId)}/entities/counts`),

  get: (organizationId: string, entityId: string) => api<Entity>(`${org(organizationId)}/entities/${entityId}`),

  create: (organizationId: string, input: EntityFields & { type: EntityType; name: string }) =>
    api<Entity>(`${org(organizationId)}/entities`, { method: 'POST', body: input }),

  update: (organizationId: string, entityId: string, changes: EntityFields) =>
    api<Entity>(`${org(organizationId)}/entities/${entityId}`, { method: 'PATCH', body: changes }),

  archive: (organizationId: string, entityId: string) =>
    api<Entity>(`${org(organizationId)}/entities/${entityId}/archive`, { method: 'POST' }),

  restore: (organizationId: string, entityId: string) =>
    api<Entity>(`${org(organizationId)}/entities/${entityId}/restore`, { method: 'POST' }),
}

export const insightService = {
  dashboard: (organizationId: string) => api<Dashboard>(`${org(organizationId)}/dashboard`),

  search: (organizationId: string, q: string, signal?: AbortSignal) =>
    api<SearchResults>(`${org(organizationId)}/search`, { query: { q }, signal }),
}

export const documentKeys = {
  /** Everything about documents in one organization; invalidate this after any change. */
  all: (organizationId: string) => ['organizations', organizationId, 'documents'] as const,
  list: (organizationId: string, params: object) =>
    ['organizations', organizationId, 'documents', 'list', params] as const,
  detail: (organizationId: string, documentId: string) =>
    ['organizations', organizationId, 'documents', 'detail', documentId] as const,
  extraction: (organizationId: string, documentId: string) =>
    ['organizations', organizationId, 'documents', 'extraction', documentId] as const,
  preview: (organizationId: string, versionId: string) =>
    ['organizations', organizationId, 'documents', 'preview', versionId] as const,
  dashboard: (organizationId: string) => ['organizations', organizationId, 'dashboard'] as const,
  search: (organizationId: string, q: string) => ['organizations', organizationId, 'search', q] as const,
}

export const entityKeys = {
  all: (organizationId: string) => ['organizations', organizationId, 'entities'] as const,
  list: (organizationId: string, params: object) =>
    ['organizations', organizationId, 'entities', 'list', params] as const,
  lookup: (organizationId: string, type?: EntityType) =>
    ['organizations', organizationId, 'entities', 'lookup', type ?? 'all'] as const,
  counts: (organizationId: string) => ['organizations', organizationId, 'entities', 'counts'] as const,
  detail: (organizationId: string, entityId: string) =>
    ['organizations', organizationId, 'entities', 'detail', entityId] as const,
}
