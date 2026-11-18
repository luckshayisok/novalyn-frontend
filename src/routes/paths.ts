/** Every route in the application, in one place. */

export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  invite: (token: string) => `/invite/${token}`,
  onboarding: '/onboarding',
  org: (slug: string) => ({
    root: `/o/${slug}`,
    overview: `/o/${slug}/overview`,
    documents: `/o/${slug}/documents`,
    upload: `/o/${slug}/documents/upload`,
    document: (documentId: string) => `/o/${slug}/documents/${documentId}`,
    entities: `/o/${slug}/entities`,
    renewals: `/o/${slug}/renewals`,
    renewal: (renewalId: string) => `/o/${slug}/renewals/${renewalId}`,
    entity: (entityId: string) => `/o/${slug}/entities/${entityId}`,
    calendar: `/o/${slug}/calendar`,
    reports: `/o/${slug}/reports`,
    billing: `/o/${slug}/billing`,
    team: `/o/${slug}/team`,
    auditLog: `/o/${slug}/audit-log`,
    settings: `/o/${slug}/settings`,
    account: `/o/${slug}/account`,
  }),
} as const

/**
 * A `next` parameter is honoured only when it is a path inside this application.
 * Absolute and protocol-relative URLs are ignored, so a crafted link cannot
 * send someone to another site after they sign in.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null
  return next
}

export function withNext(path: string, next: string | null, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra)
  if (next) params.set('next', next)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

const LAST_ORG_KEY = 'novalyn:last-organization'

export function rememberOrganization(slug: string): void {
  try {
    localStorage.setItem(LAST_ORG_KEY, slug)
  } catch {
    // Storage can be unavailable (private mode); the preference is optional.
  }
}

export function lastOrganization(): string | null {
  try {
    return localStorage.getItem(LAST_ORG_KEY)
  } catch {
    return null
  }
}
