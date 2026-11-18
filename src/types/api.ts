/** Shapes returned by the NOVALYN API (version 1). */

export type Role = 'owner' | 'admin' | 'compliance_manager' | 'member' | 'viewer'

export type Permission =
  | 'organization:read'
  | 'organization:update'
  | 'organization:delete'
  | 'members:read'
  | 'members:invite'
  | 'members:manage'
  | 'audit:read'
  | 'documents:read'
  | 'documents:write'
  | 'documents:verify'
  | 'documents:delete'
  | 'entities:read'
  | 'entities:write'
  | 'renewals:read'
  | 'renewals:manage'
  | 'reports:read'
  | 'reports:export'
  | 'settings:manage'
  | 'billing:manage'

export interface User {
  id: string
  email: string
  full_name: string
  is_email_verified: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
}

export interface Organization {
  id: string
  name: string
  slug: string
  industry: string | null
  company_size: string | null
  timezone: string
  document_categories: string[]
  onboarding_completed_at: string | null
  reminders_enabled: boolean
  reminder_offsets: number[]
  created_at: string
  role: Role
  permissions: Permission[]
}

export interface Me {
  user: User
  organizations: Organization[]
}

export interface Member {
  id: string
  role: Role
  user: User
  joined_at: string
  is_self: boolean
}

export type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'revoked'

export interface Invitation {
  id: string
  email: string
  role: Role
  status: InvitationStatus
  expires_at: string
  last_sent_at: string
  created_at: string
  invited_by_name: string | null
}

export interface InvitationPreview {
  organization_name: string
  email: string
  role: Role
  status: InvitationStatus
  invited_by_name: string | null
}

export interface AuditLogEntry {
  id: string
  action: string
  resource_type: string
  resource_id: string | null
  metadata: Record<string, unknown>
  actor: { id: string; full_name: string; email: string } | null
  created_at: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Option {
  value: string
  label: string
  description: string | null
}

export interface Options {
  industries: Option[]
  company_sizes: Option[]
  document_categories: Option[]
  roles: Option[]
}

export interface Message {
  message: string
}

export interface OrganizationUpdate {
  name?: string
  industry?: string | null
  company_size?: string | null
  timezone?: string
  document_categories?: string[]
  reminders_enabled?: boolean
  reminder_offsets?: number[]
}

// ---------------------------------------------------------------- documents

export type DocumentStatus = 'valid' | 'expiring_soon' | 'expired' | 'archived'
export type VerificationStatus = 'pending' | 'verified' | 'rejected'
export type EntityType = 'employee' | 'supplier' | 'equipment' | 'location' | 'department'

export interface EntityRef {
  id: string
  name: string
  type: EntityType
}

export interface OwnerRef {
  membership_id: string
  full_name: string
  email: string
}

export interface DocumentVersion {
  id: string
  version_number: number
  original_filename: string
  content_type: string
  size_bytes: number
  sha256: string
  note: string | null
  uploaded_by_name: string | null
  created_at: string
  previewable: boolean
  state: 'active' | 'pending' | 'rejected'
}

export interface DocumentSummary {
  id: string
  name: string
  category: string
  document_number: string | null
  issuing_authority: string | null
  holder_name: string | null
  /** Calendar dates, `YYYY-MM-DD`. */
  issue_date: string | null
  expiry_date: string | null
  notes: string | null
  status: DocumentStatus
  days_until_expiry: number | null
  verification_status: VerificationStatus
  verified_at: string | null
  verified_by_name: string | null
  rejection_reason: string | null
  entity: EntityRef | null
  owner: OwnerRef | null
  current_version: DocumentVersion | null
  version_count: number
  extraction_status: ExtractionStatus | null
  renewal: OpenRenewal | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface DocumentDetail extends DocumentSummary {
  versions: DocumentVersion[]
}

/** Editable document details. `null` clears an optional field. */
export interface DocumentFields {
  name?: string
  category?: string
  document_number?: string | null
  issuing_authority?: string | null
  holder_name?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  notes?: string | null
  entity_id?: string | null
  owner_membership_id?: string | null
}

export interface DocumentListParams {
  q?: string
  category?: string
  status?: Exclude<DocumentStatus, 'archived'>
  verification?: VerificationStatus
  entity_id?: string
  archived?: boolean
  suggestions?: boolean
  sort?: string
  page?: number
  page_size?: number
}

export interface Entity {
  id: string
  type: EntityType
  name: string
  code: string | null
  email: string | null
  phone: string | null
  contact_name: string | null
  address: string | null
  notes: string | null
  location: EntityRef | null
  department: EntityRef | null
  owner: OwnerRef | null
  archived_at: string | null
  created_at: string
  updated_at: string
  document_count: number
  expiring_soon_count: number
  expired_count: number
}

export interface EntityFields {
  name?: string
  code?: string | null
  email?: string | null
  phone?: string | null
  contact_name?: string | null
  address?: string | null
  notes?: string | null
  location_id?: string | null
  department_id?: string | null
  owner_membership_id?: string | null
}

export interface EntityTypeCount {
  type: EntityType
  label: string
  count: number
}

export interface Dashboard {
  today: string
  expiring_window_days: number
  metrics: {
    total: number
    valid: number
    expiring_soon: number
    expired: number
    pending_verification: number
    archived: number
    suggestions_to_review: number
    renewals_in_progress: number
    renewals_overdue: number
    renewals_awaiting_approval: number
  }
  by_category: Array<{ category: string; label: string; count: number }>
  upcoming_expirations: Array<{ month: string; count: number }>
  by_group: Array<{ entity_id: string; name: string; type: EntityType; count: number }>
  ungrouped_count: number
  expiring_documents: DocumentSummary[]
  expired_documents: DocumentSummary[]
  recent_documents: DocumentSummary[]
  open_renewals: DashboardRenewal[]
  renewal_trend: Array<{ month: string; started: number; completed: number }>
}

export interface SearchResults {
  documents: DocumentSummary[]
  entities: EntityRef[]
}

export interface FileUrl {
  url: string
  expires_in: number
}

// --------------------------------------------------------------- extraction

export type ExtractionStatus =
  | 'pending'
  | 'processing'
  | 'extraction_completed'
  | 'review_required'
  | 'failed'
  | 'verified'
  | 'dismissed'

/** Keys of the details a reader can suggest. */
export type ExtractedKey =
  | 'name'
  | 'category'
  | 'document_number'
  | 'issuing_authority'
  | 'holder_name'
  | 'issue_date'
  | 'expiry_date'
  | 'organization_mentioned'
  | 'entity_id'

export interface ExtractedField {
  value: string | null
  /** 0 to 1. */
  confidence: number
  evidence: string | null
  note: string | null
  /** The text as written on the document, for dates and matched records. */
  raw: string | null
}

export interface Extraction {
  id: string
  version_id: string
  status: ExtractionStatus
  provider: string | null
  provider_label: string | null
  model: string | null
  text_source: string | null
  text_source_label: string | null
  fields: Partial<Record<ExtractedKey, ExtractedField>>
  warnings: string[]
  error: string | null
  attempts: number
  started_at: string | null
  completed_at: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  applied_fields: string[]
}

export interface ExtractionState {
  enabled: boolean
  extraction: Extraction | null
}

// ---------------------------------------------------------------- lifecycle

export type RenewalStatus =
  | 'not_started'
  | 'requested'
  | 'in_progress'
  | 'submitted'
  | 'awaiting_approval'
  | 'completed'
  | 'rejected'

export interface OpenRenewal {
  id: string
  status: RenewalStatus
  deadline: string | null
  assignee: OwnerRef | null
}

export interface DashboardRenewal {
  id: string
  status: RenewalStatus
  deadline: string | null
  days_to_deadline: number | null
  overdue: boolean
  document_id: string
  document_name: string
  assignee_name: string | null
}

export interface RenewalSummary {
  id: string
  status: RenewalStatus
  deadline: string | null
  days_to_deadline: number | null
  overdue: boolean
  assignee: OwnerRef | null
  document: {
    id: string
    name: string
    category: string
    expiry_date: string | null
    status: DocumentStatus
    entity: EntityRef | null
  }
  created_at: string
  updated_at: string
}

export type RenewalAction = 'edit' | 'request' | 'start' | 'upload' | 'submit' | 'approve' | 'reject' | 'reopen'

export interface RenewalEvent {
  id: string
  action: string
  from_status: RenewalStatus | null
  to_status: RenewalStatus
  note: string | null
  actor_name: string | null
  created_at: string
}

export interface RenewalDetail extends RenewalSummary {
  notes: string | null
  previous_expiry_date: string | null
  proposed_issue_date: string | null
  proposed_expiry_date: string | null
  suggested_expiry_date: string | null
  new_version: DocumentVersion | null
  rejection_reason: string | null
  created_by_name: string | null
  completed_at: string | null
  completed_by_name: string | null
  events: RenewalEvent[]
  can: Record<RenewalAction, boolean>
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  /** A path inside the organization, for example `documents/<id>`. */
  link: string | null
  read_at: string | null
  created_at: string
}

// ------------------------------------------------------------------ calendar

export type CalendarEventType = 'expiry' | 'expired' | 'renewal_deadline' | 'approval'

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  date: string
  title: string
  document_id: string
  document_name: string
  category: string
  status: string
  renewal_id: string | null
  owner_name: string | null
  entity_name: string | null
}

export interface CalendarRange {
  start: string
  end: string
  today: string
  events: CalendarEvent[]
}

// ------------------------------------------------------------------- reports

export interface ReportInfo {
  key: string
  title: string
  description: string
  feature: PlanFeature
  allowed: boolean
  has_period: boolean
  period_label: string
  default_start: string | null
  default_end: string | null
}

export interface ReportCatalog {
  reports: ReportInfo[]
  can_export: boolean
  csv_export: boolean
  pdf_export: boolean
}

export type ReportValue = string | number | null

export interface Report {
  key: string
  title: string
  description: string
  start: string | null
  end: string | null
  generated_at: string
  columns: { key: string; label: string }[]
  rows: Record<string, ReportValue>[]
  summary: { label: string; value: ReportValue }[]
  truncated: boolean
}

// ------------------------------------------------------------------- billing

export type PlanKey = 'free' | 'starter' | 'growth' | 'business'
export type BillingInterval = 'month' | 'year'
export type PlanFeature =
  | 'automated_reminders'
  | 'custom_reminders'
  | 'basic_reports'
  | 'advanced_reports'
  | 'pdf_export'
  | 'csv_export'
  | 'document_history'
  | 'entity_management'
  | 'multiple_locations'
  | 'advanced_permissions'
  | 'custom_integrations'
  | 'priority_support'

export interface Plan {
  key: PlanKey
  name: string
  description: string
  max_documents: number | null
  max_members: number | null
  max_locations: number | null
  features: { key: PlanFeature; label: string }[]
  /** Smallest currency unit, by currency code. Null: contact sales. */
  monthly_price: Record<string, number> | null
  yearly_price: Record<string, number> | null
  self_serve: boolean
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'

export interface Subscription {
  plan: PlanKey
  plan_name: string
  effective_plan: PlanKey
  status: SubscriptionStatus
  billing_interval: BillingInterval | null
  provider: string | null
  pending_plan: PlanKey | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  custom_limits: boolean
}

export interface UsageLimit {
  used: number
  limit: number | null
}

export interface Invoice {
  id: string
  number: string | null
  status: 'paid' | 'failed' | 'refunded'
  amount: number
  currency: string
  description: string | null
  hosted_url: string | null
  issued_at: string
  provider: string
}

export interface PaymentProvider {
  name: 'stripe' | 'razorpay'
  label: string
  currency: string
  /** "plan:interval" pairs that can be paid with this provider. */
  available: string[]
}

export interface Billing {
  subscription: Subscription
  features: PlanFeature[]
  documents: UsageLimit
  members: UsageLimit
  locations: UsageLimit
  invoices: Invoice[]
  providers: PaymentProvider[]
  payments_enabled: boolean
  sales_email: string
  plans: Plan[]
}
