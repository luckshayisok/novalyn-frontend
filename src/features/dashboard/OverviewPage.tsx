import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  FileText,
  ScrollText,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/shared/misc'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { VerifyEmailBanner } from '@/features/auth/VerifyEmail'
import { actorName, describeAfterActor } from '@/features/audit/describe'
import { expiryPhrase, FileIcon, formatDay, useOptions } from '@/features/documents/shared'
import { useOrganization } from '@/hooks/useOrganization'
import { cn, formatRelative } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { documentKeys, insightService } from '@/services/documents'
import { auditService, invitationService, memberService, queryKeys } from '@/services/organizations'
import type { Dashboard, DocumentSummary } from '@/types/api'

import { HorizontalBars, StatusDonut, UpcomingExpirationsChart } from './charts'

type Tone = 'success' | 'warning' | 'destructive' | 'neutral'

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  neutral: 'text-foreground',
}

interface MetricProps {
  label: string
  value: number
  icon: LucideIcon
  tone: Tone
  hint: string
  to: string
}

function Metric({ label, value, icon: Icon, tone, hint, to }: MetricProps) {
  return (
    <Link to={to} className="rounded-lg border bg-card p-4 transition-colors hover:border-input">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <p className={cn('mt-1.5 text-[26px] font-semibold leading-8 tabular-nums', value > 0 && TONE_TEXT[tone])}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Link>
  )
}

function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ViewAll({ to, label = 'View all' }: { to: string; label?: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0">
      <Link to={to}>
        {label}
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  )
}

function DocumentList({ documents, slug, empty }: { documents: DocumentSummary[]; slug: string; empty: string }) {
  if (documents.length === 0) return <p className="py-4 text-center text-[13px] text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y">
      {documents.map((document) => (
        <li key={document.id}>
          <Link
            to={paths.org(slug).document(document.id)}
            className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/60"
          >
            <FileIcon version={document.current_version} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{document.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {document.entity?.name ?? 'Not attached to a record'}
              </span>
            </span>
            {document.expiry_date && (
              <span className="shrink-0 text-right text-xs">
                <span className="block tabular-nums">{formatDay(document.expiry_date)}</span>
                <span
                  className={cn(
                    document.status === 'expired' && 'text-destructive',
                    document.status === 'expiring_soon' && 'text-warning',
                    document.status === 'valid' && 'text-muted-foreground',
                  )}
                >
                  {expiryPhrase(document)}
                </span>
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

interface ChecklistItem {
  label: string
  done: boolean
  to?: string
}

function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const completed = items.filter((item) => item.done).length
  return (
    <Panel title="Finish setting up" description={`${completed} of ${items.length} steps complete`}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm">
            {item.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Done" />
            ) : (
              <Circle className="size-4 shrink-0 text-input" aria-label="Not done" />
            )}
            <span className={cn('flex-1', item.done && 'text-muted-foreground line-through')}>{item.label}</span>
            {!item.done && item.to && (
              <Link to={item.to} className="text-xs font-medium text-brand hover:underline">
                Open
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function DashboardBody({ data }: { data: Dashboard }) {
  const { organization, can } = useOrganization()
  const org = paths.org(organization.slug)
  const { metrics } = data
  const groupRows = data.by_group.map((group) => ({ name: group.name, count: group.count }))

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Metric
          label="Total documents"
          value={metrics.total}
          icon={FileText}
          tone="neutral"
          hint={metrics.archived ? `${metrics.archived} archived` : 'Active documents'}
          to={org.documents}
        />
        <Metric
          label="Valid"
          value={metrics.valid}
          icon={ShieldCheck}
          tone="success"
          hint={`More than ${data.expiring_window_days} days left, or no expiry`}
          to={`${org.documents}?status=valid`}
        />
        <Metric
          label="Expiring soon"
          value={metrics.expiring_soon}
          icon={Clock}
          tone="warning"
          hint={`Within ${data.expiring_window_days} days`}
          to={`${org.documents}?status=expiring_soon`}
        />
        <Metric
          label="Expired"
          value={metrics.expired}
          icon={AlertTriangle}
          tone="destructive"
          hint="Past their expiry date"
          to={`${org.documents}?status=expired`}
        />
        <Metric
          label="Pending review"
          value={metrics.pending_verification}
          icon={ClipboardCheck}
          tone="warning"
          hint="Not verified yet"
          to={`${org.documents}?review=pending`}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Document status" description="Every active document, by expiry.">
          {metrics.total === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">No documents yet.</p>
          ) : (
            <StatusDonut metrics={metrics} />
          )}
        </Panel>
        <Panel title="Upcoming expirations" description="Documents expiring in each of the next six months.">
          <UpcomingExpirationsChart data={data.upcoming_expirations} />
        </Panel>

        <Panel
          title="Expiring next"
          description="The next 90 days, soonest first."
          action={<ViewAll to={`${org.documents}?status=expiring_soon`} />}
        >
          <DocumentList documents={data.expiring_documents} slug={organization.slug} empty="Nothing expires in the next 90 days." />
        </Panel>
        <Panel
          title="Expired"
          description="Most recently expired first."
          action={<ViewAll to={`${org.documents}?status=expired`} />}
        >
          <DocumentList documents={data.expired_documents} slug={organization.slug} empty="No expired documents." />
        </Panel>

        <Panel title="By document type" description="Active documents in each type.">
          {data.by_category.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">No documents yet.</p>
          ) : (
            <HorizontalBars
              label="Documents by type"
              rows={data.by_category.map((item) => ({ name: item.label, count: item.count }))}
            />
          )}
        </Panel>
        <Panel
          title="By location or department"
          description="Counted through the record each document belongs to."
          action={can('entities:read') ? <ViewAll to={`${org.entities}?type=location`} label="Locations" /> : undefined}
        >
          {groupRows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              Attach documents to locations or departments, or to people and equipment that belong to one, to
              see them here.
            </p>
          ) : (
            <>
              <HorizontalBars label="Documents by location or department" rows={groupRows} />
              {data.ungrouped_count > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.ungrouped_count} {data.ungrouped_count === 1 ? 'document is' : 'documents are'} not linked to a
                  location or department.
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel title="Recently uploaded" action={<ViewAll to={`${org.documents}?sort=-created_at`} />}>
          <DocumentList documents={data.recent_documents} slug={organization.slug} empty="Nothing uploaded yet." />
        </Panel>
        {can('audit:read') && <RecentActivity />}
      </div>
    </>
  )
}

function RecentActivity() {
  const { organization } = useOrganization()
  const params = { page: 1, pageSize: 6 }
  const activity = useQuery({
    queryKey: queryKeys.auditLogs(organization.id, params),
    queryFn: () => auditService.list(organization.id, params),
  })
  return (
    <Panel title="Recent activity" action={<ViewAll to={paths.org(organization.slug).auditLog} label="Audit log" />}>
      {activity.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-8" />
          ))}
        </div>
      ) : activity.isError ? (
        <ErrorState error={activity.error} onRetry={() => void activity.refetch()} className="py-6" />
      ) : activity.data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" description="Changes will appear here." className="py-6" />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {activity.data.items.map((entry) => (
            <li key={entry.id} className="flex gap-3 text-[13px]">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium">{actorName(entry)}</span> {describeAfterActor(entry)}
                </p>
                <p className="text-xs text-muted-foreground">{formatRelative(entry.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function OverviewPage() {
  const { organization, can } = useOrganization()
  const user = useCurrentUser()
  const org = paths.org(organization.slug)
  useOptions() // warm the document-type labels used across the dashboard

  const dashboard = useQuery({
    queryKey: documentKeys.dashboard(organization.id),
    queryFn: () => insightService.dashboard(organization.id),
  })
  const members = useQuery({
    queryKey: queryKeys.members(organization.id),
    queryFn: () => memberService.list(organization.id),
    enabled: can('organization:update'),
  })
  const invitations = useQuery({
    queryKey: queryKeys.invitations(organization.id),
    queryFn: () => invitationService.list(organization.id),
    enabled: can('members:invite'),
  })

  const checklist: ChecklistItem[] = [
    {
      label: 'Complete the organization profile',
      done: Boolean(organization.industry && organization.company_size),
      to: org.settings,
    },
    { label: 'Confirm your email address', done: user.is_email_verified },
    {
      label: 'Invite your team',
      done: (members.data?.length ?? 0) > 1 || (invitations.data?.length ?? 0) > 0,
      to: org.team,
    },
    { label: 'Upload your first document', done: (dashboard.data?.metrics.total ?? 0) > 0, to: org.upload },
  ]
  const showChecklist =
    can('organization:update') && dashboard.isSuccess && members.isSuccess && checklist.some((item) => !item.done)

  return (
    <>
      <PageHeader
        title="Overview"
        description={organization.name}
        actions={
          can('documents:write') && (
            <Button asChild>
              <Link to={org.upload}>
                <Upload aria-hidden />
                Upload documents
              </Link>
            </Button>
          )
        }
      />
      <VerifyEmailBanner className="mb-6" />
      {showChecklist && (
        <div className="mb-6">
          <SetupChecklist items={checklist} />
        </div>
      )}

      {dashboard.isPending ? (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5" role="status" aria-label="Loading dashboard">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-[106px] rounded-lg" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <Card>
          <ErrorState error={dashboard.error} title="The dashboard could not be loaded" onRetry={() => void dashboard.refetch()} />
        </Card>
      ) : dashboard.data.metrics.total === 0 && dashboard.data.metrics.archived === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Upload your first document"
            description="Add a license, certificate, insurance policy or permit. NOVALYN tracks its expiry date and shows it here."
            action={
              can('documents:write') && (
                <Button asChild>
                  <Link to={org.upload}>
                    <Upload aria-hidden />
                    Upload documents
                  </Link>
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <DashboardBody data={dashboard.data} />
      )}
    </>
  )
}
