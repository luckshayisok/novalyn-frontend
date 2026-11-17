import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { Organization, Permission } from '@/types/api'

interface OrganizationContextValue {
  organization: Organization
  /** Whether the signed-in user holds a permission in this organization. */
  can: (permission: Permission) => boolean
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

export function OrganizationProvider({
  organization,
  children,
}: {
  organization: Organization
  children: ReactNode
}) {
  const value = useMemo<OrganizationContextValue>(() => {
    const granted = new Set<Permission>(organization.permissions)
    return { organization, can: (permission) => granted.has(permission) }
  }, [organization])
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

/** The organization selected in the URL. Available under `/o/:orgSlug`. */
export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext)
  if (!context) throw new Error('useOrganization must be used under an organization route')
  return context
}
