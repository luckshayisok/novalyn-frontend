import { ROLE_LABELS } from '@/lib/permissions'
import type { AuditLogEntry, Role } from '@/types/api'

const FIELD_LABELS: Record<string, string> = {
  category: 'type',
  document_number: 'number',
  issuing_authority: 'issuer',
  holder_name: 'holder',
  issue_date: 'issue date',
  expiry_date: 'expiry date',
  notes: 'notes',
  entity_id: 'linked record',
  owner_membership_id: 'owner',
  code: 'code',
  email: 'email',
  phone: 'phone',
  contact_name: 'contact',
  address: 'address',
  location_id: 'location',
  department_id: 'department',
  name: 'name',
  industry: 'industry',
  company_size: 'company size',
  timezone: 'time zone',
  document_categories: 'document types',
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function fieldList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return 'the details'
  return value.map((field) => FIELD_LABELS[String(field)] ?? String(field)).join(', ')
}

function roleLabel(value: unknown): string {
  const role = text(value)
  return role in ROLE_LABELS ? ROLE_LABELS[role as Role] : role
}

const PLAN_NAMES: Record<string, string> = { free: 'Free', starter: 'Starter', growth: 'Growth', business: 'Business' }

function planName(value: unknown): string {
  const plan = text(value)
  return PLAN_NAMES[plan] ?? plan
}

/** A plain-language sentence for an audit entry, written without the actor ("Invited x as Member"). */
export function describeAuditEntry(entry: AuditLogEntry): string {
  const data = entry.metadata
  switch (entry.action) {
    case 'organization.created':
      return 'Created the organization'
    case 'organization.settings_changed': {
      const changes = data.changes
      const fields =
        typeof changes === 'object' && changes !== null
          ? Object.keys(changes).map((field) => FIELD_LABELS[field] ?? field)
          : []
      return fields.length > 0 ? `Changed the organization's ${fields.join(', ')}` : 'Changed organization settings'
    }
    case 'organization.onboarding_completed':
      return 'Completed organization setup'
    case 'member.invited':
      return `Invited ${text(data.email)} as ${roleLabel(data.role)}`
    case 'member.invitation_resent':
      return `Resent the invitation to ${text(data.email)}`
    case 'member.invitation_revoked':
      return `Revoked the invitation for ${text(data.email)}`
    case 'member.joined':
      return `Joined the organization as ${roleLabel(data.role)}`
    case 'member.role_changed':
      return `Changed ${text(data.email)} from ${roleLabel(data.from)} to ${roleLabel(data.to)}`
    case 'member.removed':
      return `Removed ${text(data.email)} from the organization`
    case 'member.left':
      return 'Left the organization'
    case 'document.uploaded':
      return `Uploaded ${text(data.name)}`
    case 'document.updated':
      return `Changed ${fieldList(data.fields)} of ${text(data.name)}`
    case 'document.version_added':
      return `Uploaded version ${String(data.version ?? '')} of ${text(data.name)}`
    case 'document.verified':
      return `Verified ${text(data.name)}`
    case 'document.rejected':
      return `Rejected ${text(data.name)}: ${text(data.reason)}`
    case 'document.downloaded':
      return `Downloaded ${text(data.name)}`
    case 'document.archived':
      return `Archived ${text(data.name)}`
    case 'document.restored':
      return `Restored ${text(data.name)}`
    case 'document.extraction_applied':
      return `Saved suggested ${fieldList(data.fields)} for ${text(data.name)}${data.verified ? ' and verified it' : ''}`
    case 'document.extraction_dismissed':
      return `Closed the suggestions for ${text(data.name)}`
    case 'document.extraction_retried':
      return `Asked for ${text(data.name)} to be read again`
    case 'renewal.created':
      return `Started a renewal of ${text(data.document)}`
    case 'renewal.requested':
      return `Requested the renewal of ${text(data.document)}`
    case 'renewal.updated':
      return `Changed the renewal of ${text(data.document)}`
    case 'renewal.file_uploaded':
      return `Uploaded the renewed ${text(data.document)}`
    case 'renewal.submitted':
      return `Sent the renewal of ${text(data.document)} for approval`
    case 'renewal.completed':
      return `Approved the renewal of ${text(data.document)}`
    case 'renewal.rejected':
      return `Rejected the renewal of ${text(data.document)}: ${text(data.reason)}`
    case 'renewal.reopened':
      return `Reopened the renewal of ${text(data.document)}`
    case 'entity.created':
      return `Added ${text(data.name)}`
    case 'entity.updated':
      return `Changed ${fieldList(data.fields)} of ${text(data.name)}`
    case 'entity.archived':
      return `Archived ${text(data.name)}`
    case 'entity.restored':
      return `Restored ${text(data.name)}`
    case 'report.exported':
      return `Exported the ${text(data.name)} report as ${String(data.format ?? '').toUpperCase()}`
    case 'billing.checkout_started':
      return `Started paying for the ${planName(data.plan)} plan`
    case 'billing.cancellation_requested':
      return `Cancelled the ${planName(data.plan)} subscription at the end of the paid period`
    case 'billing.plan_changed':
      return `Plan changed from ${planName(data.from_plan)} to ${planName(data.plan)}`
    case 'billing.status_changed':
      return `Subscription status changed to ${text(data.status).replace('_', ' ')}`
    case 'billing.payment_failed':
      return `A payment for the ${planName(data.plan)} plan failed`
    case 'billing.subscription_ended':
      return `The ${planName(data.from_plan)} subscription ended; the organization is on the Free plan`
    default:
      return entry.action
  }
}

/** The same sentence with a lower-case first letter, to follow the actor's name. */
export function describeAfterActor(entry: AuditLogEntry): string {
  const sentence = describeAuditEntry(entry)
  return sentence.charAt(0).toLowerCase() + sentence.slice(1)
}

export function actorName(entry: AuditLogEntry): string {
  if (entry.actor) return entry.actor.full_name
  // Billing changes reported by the payment provider, and plan changes made by our team, have no person behind them.
  return entry.action.startsWith('billing.') ? 'NOVALYN billing' : 'Deleted user'
}
