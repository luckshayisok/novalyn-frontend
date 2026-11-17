import { api, upload } from '@/lib/http'
import type { AppNotification, Page, RenewalDetail, RenewalSummary } from '@/types/api'

const org = (organizationId: string) => `/organizations/${organizationId}`

export type RenewalListFilter = 'open' | 'overdue' | 'awaiting_approval' | 'closed'

export const notificationService = {
  list: (organizationId: string, params: { unread?: boolean; page?: number; page_size?: number } = {}) =>
    api<Page<AppNotification>>(`${org(organizationId)}/notifications`, {
      query: { ...params, unread: params.unread ? 'true' : undefined },
    }),

  unreadCount: (organizationId: string) =>
    api<{ unread: number }>(`${org(organizationId)}/notifications/unread-count`),

  markRead: (organizationId: string, notificationId: string) =>
    api<AppNotification>(`${org(organizationId)}/notifications/${notificationId}/read`, { method: 'POST' }),

  markAllRead: (organizationId: string) =>
    api<void>(`${org(organizationId)}/notifications/read-all`, { method: 'POST' }),
}

export const renewalService = {
  list: (organizationId: string, params: { status: RenewalListFilter; mine?: boolean; page?: number; page_size?: number }) =>
    api<Page<RenewalSummary>>(`${org(organizationId)}/renewals`, {
      query: { ...params, mine: params.mine ? 'true' : undefined },
    }),

  get: (organizationId: string, renewalId: string) =>
    api<RenewalDetail>(`${org(organizationId)}/renewals/${renewalId}`),

  create: (
    organizationId: string,
    input: { document_id: string; assignee_membership_id?: string | null; deadline?: string | null; notes?: string | null; request: boolean },
  ) => api<RenewalDetail>(`${org(organizationId)}/renewals`, { method: 'POST', body: input }),

  update: (
    organizationId: string,
    renewalId: string,
    changes: { assignee_membership_id?: string | null; deadline?: string; notes?: string | null },
  ) => api<RenewalDetail>(`${org(organizationId)}/renewals/${renewalId}`, { method: 'PATCH', body: changes }),

  step: (
    organizationId: string,
    renewalId: string,
    step: 'request' | 'start' | 'submit' | 'approve' | 'reopen',
    note?: string,
  ) =>
    api<RenewalDetail>(`${org(organizationId)}/renewals/${renewalId}/${step}`, {
      method: 'POST',
      body: note ? { note } : undefined,
    }),

  reject: (organizationId: string, renewalId: string, reason: string) =>
    api<RenewalDetail>(`${org(organizationId)}/renewals/${renewalId}/reject`, { method: 'POST', body: { reason } }),

  uploadFile: (
    organizationId: string,
    renewalId: string,
    file: File,
    fields: { issue_date?: string; expiry_date?: string; note?: string },
    onProgress?: (fraction: number) => void,
  ) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value)
    form.append('file', file)
    return upload<RenewalDetail>(`${org(organizationId)}/renewals/${renewalId}/file`, form, onProgress)
  },
}

export const lifecycleKeys = {
  unread: (organizationId: string) => ['organizations', organizationId, 'notifications', 'unread'] as const,
  notifications: (organizationId: string) => ['organizations', organizationId, 'notifications'] as const,
  renewals: (organizationId: string) => ['organizations', organizationId, 'renewals'] as const,
  renewalList: (organizationId: string, params: object) =>
    ['organizations', organizationId, 'renewals', 'list', params] as const,
  renewal: (organizationId: string, renewalId: string) =>
    ['organizations', organizationId, 'renewals', 'detail', renewalId] as const,
}
