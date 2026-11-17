/**
 * Role rules mirrored from the API so the UI can hide controls the caller may
 * not use. The server enforces the same rules; this file only decides what to show.
 */

import type { Role } from '@/types/api'

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  compliance_manager: 'Compliance Manager',
  member: 'Member',
  viewer: 'Viewer',
}

const ROLE_RANK: Record<Role, number> = {
  owner: 50,
  admin: 40,
  compliance_manager: 30,
  member: 20,
  viewer: 10,
}

const ALL_ROLES: Role[] = ['owner', 'admin', 'compliance_manager', 'member', 'viewer']

/** Roles the actor may grant to an existing member. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === 'owner') return ALL_ROLES
  if (actor === 'admin') return ALL_ROLES.filter((role) => ROLE_RANK[role] < ROLE_RANK.admin)
  return []
}

/** Roles the actor may invite someone as. Ownership is never granted by invitation. */
export function invitableRoles(actor: Role): Role[] {
  return assignableRoles(actor).filter((role) => role !== 'owner')
}

/** Whether the actor may change the role of, or remove, a member holding the target role. */
export function canManageMember(actor: Role, target: Role): boolean {
  if (actor === 'owner') return true
  if (actor === 'admin') return ROLE_RANK[target] < ROLE_RANK.admin
  return false
}
