import { api } from '@/lib/http'
import type {
  AuditLogEntry,
  Invitation,
  InvitationPreview,
  Member,
  Options,
  Organization,
  OrganizationUpdate,
  Page,
  Role,
} from '@/types/api'

const org = (organizationId: string) => `/organizations/${organizationId}`

export const organizationService = {
  create: (input: { name: string; timezone?: string }) =>
    api<Organization>('/organizations', { method: 'POST', body: input }),

  update: (organizationId: string, changes: OrganizationUpdate) =>
    api<Organization>(org(organizationId), { method: 'PATCH', body: changes }),

  completeOnboarding: (organizationId: string) =>
    api<Organization>(`${org(organizationId)}/onboarding/complete`, { method: 'POST' }),

  leave: (organizationId: string) => api<void>(`${org(organizationId)}/leave`, { method: 'POST' }),

  options: () => api<Options>('/meta/options', { auth: false }),
}

export const memberService = {
  list: (organizationId: string) => api<Member[]>(`${org(organizationId)}/members`),

  changeRole: (organizationId: string, membershipId: string, role: Role) =>
    api<Member>(`${org(organizationId)}/members/${membershipId}`, { method: 'PATCH', body: { role } }),

  remove: (organizationId: string, membershipId: string) =>
    api<void>(`${org(organizationId)}/members/${membershipId}`, { method: 'DELETE' }),
}

export const invitationService = {
  list: (organizationId: string) => api<Invitation[]>(`${org(organizationId)}/invitations`),

  create: (organizationId: string, input: { email: string; role: Role }) =>
    api<Invitation>(`${org(organizationId)}/invitations`, { method: 'POST', body: input }),

  resend: (organizationId: string, invitationId: string) =>
    api<Invitation>(`${org(organizationId)}/invitations/${invitationId}/resend`, { method: 'POST' }),

  revoke: (organizationId: string, invitationId: string) =>
    api<void>(`${org(organizationId)}/invitations/${invitationId}`, { method: 'DELETE' }),

  preview: (token: string) =>
    api<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`, { auth: false }),

  accept: (token: string) =>
    api<Organization>(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
}

export const auditService = {
  list: (
    organizationId: string,
    params: { page: number; pageSize: number; action?: string; actor?: string; start?: string; end?: string },
  ) =>
    api<Page<AuditLogEntry>>(`${org(organizationId)}/audit-logs`, {
      query: {
        page: params.page,
        page_size: params.pageSize,
        action: params.action,
        actor: params.actor,
        start: params.start,
        end: params.end,
      },
    }),
}

/** Query keys, kept in one place so invalidation stays consistent. */
export const queryKeys = {
  session: ['session'] as const,
  options: ['options'] as const,
  members: (organizationId: string) => ['organizations', organizationId, 'members'] as const,
  invitations: (organizationId: string) => ['organizations', organizationId, 'invitations'] as const,
  auditLogs: (organizationId: string, params?: object) =>
    params
      ? (['organizations', organizationId, 'audit-logs', params] as const)
      : (['organizations', organizationId, 'audit-logs'] as const),
  invitationPreview: (token: string) => ['invitation-preview', token] as const,
}
