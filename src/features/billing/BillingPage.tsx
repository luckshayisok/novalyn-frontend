import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Mail, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog, PageHeader } from '@/components/shared/misc'
import { EmptyState, ErrorState, Notice } from '@/components/shared/states'
import { Badge, Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrganization } from '@/hooks/useOrganization'
import { errorMessage } from '@/lib/http'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { billingService, insightKeys } from '@/services/insights'
import type { Billing, BillingInterval, Plan, SubscriptionStatus, UsageLimit } from '@/types/api'

const STATUS: Record<SubscriptionStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'neutral' }> = {
  active: { label: 'Active', variant: 'success' },
  trialing: { label: 'Trial', variant: 'success' },
  past_due: { label: 'Payment failed', variant: 'destructive' },
  canceled: { label: 'Ended', variant: 'neutral' },
  incomplete: { label: 'Waiting for payment', variant: 'warning' },
}

const PROVIDER_NAMES: Record<string, string> = { stripe: 'Stripe', razorpay: 'Razorpay', manual: 'our team' }

function Meter({ label, usage, unit }: { label: string; usage: UsageLimit; unit: string }) {
  const share = usage.limit ? Math.min(1, usage.used / usage.limit) : 0
  const full = usage.limit !== null && usage.used >= usage.limit
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[13px] tabular-nums text-muted-foreground">
          {usage.used} {usage.limit === null ? unit : `of ${usage.limit}`}
        </p>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={usage.limit ?? undefined}
        aria-valuenow={usage.used}
      >
        <div
          className={cn('h-full rounded-full', share > 0.8 ? 'bg-warning' : 'bg-brand')}
          style={{ width: usage.limit === null ? '0%' : `${Math.max(share * 100, usage.used ? 2 : 0)}%` }}
        />
      </div>
      {usage.limit === null && <p className="mt-1 text-xs text-muted-foreground">Unlimited</p>}
      {full && <p className="mt-1 text-xs text-warning">At your plan's limit: upgrade to add more.</p>}
    </div>
  )
}

function limitText(value: number | null, singular: string, pluralWord: string): string {
  if (value === null) return `Unlimited ${pluralWord}`
  return `${value} ${value === 1 ? singular : pluralWord}`
}

function price(plan: Plan, interval: BillingInterval, currency: string): { amount: string; note: string } | null {
  const prices = interval === 'year' ? plan.yearly_price : plan.monthly_price
  if (!prices || prices[currency] === undefined) return null
  const amount = prices[currency]!
  if (amount === 0) return { amount: formatMoney(0, currency), note: 'forever' }
  return { amount: formatMoney(amount, currency), note: interval === 'year' ? 'per year' : 'per month' }
}

interface PlanCardProps {
  plan: Plan
  billing: Billing
  interval: BillingInterval
  currency: string
  canManage: boolean
  onCheckout: (plan: Plan, provider: string) => Promise<void>
  pendingProvider: string | null
}

function PlanCard({ plan, billing, interval, currency, canManage, onCheckout, pendingProvider }: PlanCardProps) {
  const subscription = billing.subscription
  const current = subscription.effective_plan === plan.key
  const shown = price(plan, interval, currency)
  const salesLink = `mailto:${billing.sales_email}?subject=${encodeURIComponent(`NOVALYN ${plan.name} plan`)}`
  const payingOnline = subscription.plan !== 'free' && subscription.provider !== null && subscription.provider !== 'manual'
  const lockedIn = payingOnline && !subscription.cancel_at_period_end && subscription.status !== 'canceled'
  const providers = billing.providers.filter((provider) => provider.available.includes(`${plan.key}:${interval}`))

  let action: React.ReactNode = null
  if (current) {
    action = (
      <Button variant="secondary" className="w-full" disabled>
        Current plan
      </Button>
    )
  } else if (plan.key === 'free') {
    action = null
  } else if (!plan.self_serve || !billing.payments_enabled || lockedIn) {
    action = (
      <Button asChild variant="outline" className="w-full">
        <a href={salesLink}>
          <Mail aria-hidden />
          {plan.self_serve ? 'Contact us to switch' : 'Contact sales'}
        </a>
      </Button>
    )
  } else if (!canManage) {
    action = <p className="text-center text-xs text-muted-foreground">Only the owner can change the plan.</p>
  } else if (providers.length === 0) {
    action = (
      <p className="text-center text-xs text-muted-foreground">
        {interval === 'year' ? 'Yearly' : 'Monthly'} billing is not available for this plan yet.
      </p>
    )
  } else {
    action = (
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button
            key={provider.name}
            variant={plan.key === 'growth' ? 'brand' : 'default'}
            className="w-full"
            loading={pendingProvider === `${plan.key}:${provider.name}`}
            disabled={pendingProvider !== null}
            onClick={() => void onCheckout(plan, provider.name)}
          >
            {providers.length > 1 ? `Pay with ${PROVIDER_NAMES[provider.name]} (${provider.currency})` : `Upgrade to ${plan.name}`}
          </Button>
        ))}
      </div>
    )
  }

  return (
    <Card className={cn('flex flex-col p-5', current && 'ring-2 ring-brand/60')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{plan.name}</h3>
        {current && <Badge variant="brand">Your plan</Badge>}
      </div>
      <p className="mt-1 min-h-10 text-[13px] text-muted-foreground">{plan.description}</p>
      <div className="mt-3 min-h-14">
        {shown ? (
          <p>
            <span className="text-2xl font-semibold tabular-nums">{shown.amount}</span>{' '}
            <span className="text-xs text-muted-foreground">{shown.note}</span>
          </p>
        ) : (
          <p className="text-lg font-semibold">Custom pricing</p>
        )}
      </div>
      <ul className="mt-2 flex flex-1 flex-col gap-1.5 text-[13px]">
        {[
          limitText(plan.max_documents, 'document', 'documents'),
          limitText(plan.max_members, 'person', 'people'),
          limitText(plan.max_locations, 'location', 'locations'),
          ...plan.features.map((feature) => feature.label),
        ].map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  )
}

/** Plan, usage, upgrades through the payment provider, and billing history. */
export function BillingPage() {
  const { organization, can } = useOrganization()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutResult = searchParams.get('checkout')
  const [interval, setBillingInterval] = useState<BillingInterval>('month')
  const [currencyChoice, setCurrencyChoice] = useState<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const billing = useQuery({
    queryKey: insightKeys.billing(organization.id),
    queryFn: () => billingService.get(organization.id),
    // After returning from the payment page, look again until the provider's confirmation arrives.
    refetchInterval: (query) =>
      checkoutResult === 'success' && query.state.data?.subscription.pending_plan ? 4000 : false,
  })

  if (billing.isPending) return <Skeleton className="h-96" />
  if (billing.isError) return <ErrorState error={billing.error} onRetry={() => void billing.refetch()} />

  const data = billing.data
  const subscription = data.subscription
  const canManage = can('billing:manage')
  const currencies = data.providers.length > 0 ? [...new Set(data.providers.map((p) => p.currency))] : ['USD', 'INR']
  const currency = currencyChoice && currencies.includes(currencyChoice) ? currencyChoice : currencies[0]!
  const waiting = subscription.pending_plan !== null && subscription.pending_plan !== subscription.effective_plan
  const canCancel =
    canManage &&
    subscription.plan !== 'free' &&
    (subscription.provider === 'stripe' || subscription.provider === 'razorpay') &&
    !subscription.cancel_at_period_end &&
    subscription.status !== 'canceled'

  const checkout = async (plan: Plan, provider: string) => {
    setPendingProvider(`${plan.key}:${provider}`)
    try {
      const { url } = await billingService.checkout(organization.id, {
        plan: plan.key as 'starter' | 'growth',
        interval,
        provider,
      })
      window.location.assign(url)
    } catch (error) {
      toast.error(errorMessage(error))
      setPendingProvider(null)
      void billing.refetch()
    }
  }

  const cancel = async () => {
    const { message } = await billingService.cancel(organization.id)
    toast.success(message)
    await queryClient.invalidateQueries({ queryKey: insightKeys.billing(organization.id) })
  }

  const status = STATUS[subscription.status]
  const periodEnd = subscription.current_period_end ? formatDate(subscription.current_period_end) : null

  return (
    <>
      <PageHeader title="Plan and billing" description="What your plan includes, what you use, and your payments." />

      <div className="flex flex-col gap-4">
        {checkoutResult === 'success' && (
          <Notice
            variant={waiting ? 'info' : 'success'}
            title={waiting ? 'Payment received by the provider' : 'Your plan is active'}
            action={
              <Button variant="ghost" size="sm" onClick={() => setSearchParams({}, { replace: true })}>
                Dismiss
              </Button>
            }
          >
            {waiting
              ? 'Your plan changes as soon as the payment provider confirms the payment. This usually takes a few seconds; this page updates by itself.'
              : `You are on the ${subscription.plan_name} plan.`}
          </Notice>
        )}
        {checkoutResult === 'canceled' && (
          <Notice
            title="Checkout was not completed"
            action={
              <Button variant="ghost" size="sm" onClick={() => setSearchParams({}, { replace: true })}>
                Dismiss
              </Button>
            }
          >
            Nothing was charged and your plan has not changed.
          </Notice>
        )}
        {subscription.status === 'past_due' && (
          <Notice variant="error" title="A payment failed">
            {PROVIDER_NAMES[subscription.provider ?? ''] ?? 'The payment provider'} will try again. Update your payment
            method there to keep the {subscription.plan_name} plan.
          </Notice>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current plan</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{subscription.plan_name}</h2>
              <Badge variant={status.variant}>{status.label}</Badge>
              {subscription.custom_limits && <Badge variant="outline">Custom limits</Badge>}
            </div>
            <div className="mt-3 flex flex-col gap-1 text-[13px] text-muted-foreground">
              {subscription.billing_interval && (
                <p>Billed {subscription.billing_interval === 'year' ? 'yearly' : 'monthly'} through {PROVIDER_NAMES[subscription.provider ?? ''] ?? subscription.provider}.</p>
              )}
              {subscription.provider === 'manual' && <p>Billing for this plan is arranged with our team.</p>}
              {periodEnd &&
                (subscription.cancel_at_period_end ? (
                  <p className="text-warning">Ends on {periodEnd}. After that the organization moves to the Free plan.</p>
                ) : (
                  <p>Renews on {periodEnd}.</p>
                ))}
              {waiting && checkoutResult !== 'success' && (
                <p>A checkout for another plan was started but no payment has been confirmed.</p>
              )}
            </div>
            {canCancel && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setCancelOpen(true)}>
                Cancel subscription
              </Button>
            )}
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Usage</p>
            <Meter label="Active documents" usage={data.documents} unit="documents" />
            <Meter label="People, including open invitations" usage={data.members} unit="people" />
            <Meter label="Locations" usage={data.locations} unit="locations" />
          </Card>
        </div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Plans</h2>
            <p className="text-[13px] text-muted-foreground">Limits are checked on every upload and invitation.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {currencies.length > 1 && (
              <div className="flex rounded-md border bg-card p-0.5" role="group" aria-label="Currency">
                {currencies.map((code) => (
                  <Button
                    key={code}
                    size="sm"
                    variant={currency === code ? 'secondary' : 'ghost'}
                    aria-pressed={currency === code}
                    onClick={() => setCurrencyChoice(code)}
                  >
                    {code}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex rounded-md border bg-card p-0.5" role="group" aria-label="Billing period">
              {(['month', 'year'] as const).map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={interval === option ? 'secondary' : 'ghost'}
                  aria-pressed={interval === option}
                  onClick={() => setBillingInterval(option)}
                >
                  {option === 'month' ? 'Monthly' : 'Yearly'}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {!data.payments_enabled && (
          <Notice title="Online payment is not set up yet">
            To change your plan, write to{' '}
            <a className="font-medium text-brand underline-offset-4 hover:underline" href={`mailto:${data.sales_email}`}>
              {data.sales_email}
            </a>
            .
          </Notice>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              billing={data}
              interval={interval}
              currency={currency}
              canManage={canManage}
              onCheckout={checkout}
              pendingProvider={pendingProvider}
            />
          ))}
        </div>

        <h2 className="mt-2 text-base font-semibold">Billing history</h2>
        <Card className="overflow-hidden">
          {data.invoices.length === 0 ? (
            <EmptyState icon={Receipt} title="No payments yet" description="Invoices from the payment provider will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Link</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="pl-5 tabular-nums">{formatDate(invoice.issued_at)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{invoice.number ?? invoice.description ?? 'Subscription'}</p>
                      <p className="text-xs text-muted-foreground">{PROVIDER_NAMES[invoice.provider] ?? invoice.provider}</p>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'failed' ? 'destructive' : 'neutral'}>
                        {invoice.status === 'paid' ? 'Paid' : invoice.status === 'failed' ? 'Failed' : 'Refunded'}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {invoice.hosted_url && (
                        <Button asChild variant="link" size="sm">
                          <a href={invoice.hosted_url} target="_blank" rel="noopener noreferrer">
                            View
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel the subscription?"
        description={
          <p>
            The {subscription.plan_name} plan stays until {periodEnd ?? 'the end of the paid period'}. After that the
            organization moves to the Free plan: your documents stay, but you cannot add documents or people beyond the Free limits.
          </p>
        }
        confirmLabel="Cancel subscription"
        destructive
        onConfirm={cancel}
      />
    </>
  )
}
