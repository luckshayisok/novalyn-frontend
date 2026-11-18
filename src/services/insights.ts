import { api, ApiError, downloadFile } from '@/lib/http'
import type {
  Billing,
  BillingInterval,
  CalendarEventType,
  CalendarRange,
  Plan,
  Report,
  ReportCatalog,
} from '@/types/api'

const org = (organizationId: string) => `/organizations/${organizationId}`

export interface CalendarParams {
  start: string
  end: string
  types?: CalendarEventType[]
  category?: string
  owner?: string
  location?: string
}

export const calendarService = {
  range: (organizationId: string, params: CalendarParams) => {
    // `types` is a repeated query parameter, which the shared query builder does not cover.
    const search = new URLSearchParams({ start: params.start, end: params.end })
    for (const type of params.types ?? []) search.append('types', type)
    if (params.category) search.set('category', params.category)
    if (params.owner) search.set('owner', params.owner)
    if (params.location) search.set('location', params.location)
    return api<CalendarRange>(`${org(organizationId)}/calendar?${search.toString()}`)
  },
}

export interface ReportPeriod {
  start?: string
  end?: string
}

export const reportService = {
  catalog: (organizationId: string) => api<ReportCatalog>(`${org(organizationId)}/reports`),

  run: (organizationId: string, key: string, period: ReportPeriod) =>
    api<Report>(`${org(organizationId)}/reports/${key}`, { query: { ...period } }),

  download: (organizationId: string, key: string, period: ReportPeriod, format: 'csv' | 'pdf') =>
    downloadFile(`${org(organizationId)}/reports/${key}`, { ...period, format }, `novalyn-${key}.${format}`),
}

export const billingService = {
  get: (organizationId: string) => api<Billing>(`${org(organizationId)}/billing`),

  plans: () => api<Plan[]>('/billing/plans', { auth: false }),

  checkout: (organizationId: string, input: { plan: 'starter' | 'growth'; interval: BillingInterval; provider?: string }) =>
    api<{ url: string }>(`${org(organizationId)}/billing/checkout`, { method: 'POST', body: input }),

  cancel: (organizationId: string) =>
    api<{ message: string }>(`${org(organizationId)}/billing/cancel`, { method: 'POST' }),
}

export const insightKeys = {
  calendar: (organizationId: string, params: CalendarParams) =>
    ['organizations', organizationId, 'calendar', params] as const,
  reportCatalog: (organizationId: string) => ['organizations', organizationId, 'reports'] as const,
  report: (organizationId: string, key: string, period: ReportPeriod) =>
    ['organizations', organizationId, 'reports', key, period] as const,
  billing: (organizationId: string) => ['organizations', organizationId, 'billing'] as const,
}

/** True when the server refused because of the organization's plan (HTTP 402). */
export function isPlanError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 402
}
