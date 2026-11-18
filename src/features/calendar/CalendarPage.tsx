import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/shared/misc'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Badge, Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, NativeSelect } from '@/components/ui/select'
import { useOptions } from '@/features/documents/shared'
import { useOrganization } from '@/hooks/useOrganization'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { entityKeys, entityService } from '@/services/documents'
import { calendarService, insightKeys, type CalendarParams } from '@/services/insights'
import { memberService, queryKeys } from '@/services/organizations'
import type { CalendarEvent, CalendarEventType } from '@/types/api'

/* Dates are handled as `YYYY-MM-DD` strings in the organization's calendar, never as instants. */

function parse(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

function iso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Monday on or before the date. */
function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

const monthTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const dayTitle = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

const EVENT_STYLES: Record<CalendarEventType, { label: string; dot: string; chip: string }> = {
  expired: { label: 'Expired', dot: 'bg-destructive', chip: 'bg-destructive-soft text-destructive' },
  expiry: { label: 'Expires', dot: 'bg-warning', chip: 'bg-warning-soft text-warning' },
  renewal_deadline: { label: 'Renewal due', dot: 'bg-brand', chip: 'bg-brand-soft text-brand' },
  approval: { label: 'Approval due', dot: 'bg-success', chip: 'bg-success-soft text-success' },
}

const TYPE_FILTERS = [
  { value: 'expiry', label: 'Expirations' },
  { value: 'renewal_deadline', label: 'Renewal deadlines' },
  { value: 'approval', label: 'Approvals' },
] as const

function eventLink(slug: string, event: CalendarEvent): string {
  const org = paths.org(slug)
  return event.renewal_id ? org.renewal(event.renewal_id) : org.document(event.document_id)
}

function EventChip({ event, slug }: { event: CalendarEvent; slug: string }) {
  const style = EVENT_STYLES[event.type]
  return (
    <Link
      to={eventLink(slug, event)}
      title={event.title}
      className={cn(
        'block truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-4 hover:underline',
        style.chip,
      )}
    >
      {event.document_name}
    </Link>
  )
}

function EventRow({ event, slug, categoryLabel }: { event: CalendarEvent; slug: string; categoryLabel: (value: string) => string }) {
  const style = EVENT_STYLES[event.type]
  return (
    <li>
      <Link
        to={eventLink(slug, event)}
        className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent"
      >
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', style.dot)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{event.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[categoryLabel(event.category), event.entity_name, event.owner_name].filter(Boolean).join(' · ')}
          </span>
        </span>
        <Badge variant="outline" className="shrink-0">
          {style.label}
        </Badge>
      </Link>
    </li>
  )
}

/** Expirations, renewal deadlines and approvals by month, or as a list. */
export function CalendarPage() {
  const { organization } = useOrganization()
  const { categories, categoryLabel } = useOptions()
  const [searchParams, setSearchParams] = useSearchParams()

  // The browser's date until the server answers with the organization's own "today".
  const [browserToday] = useState(() => iso(new Date()))
  const monthParam = searchParams.get('month')
  const anchor = /^\d{4}-\d{2}$/.test(monthParam ?? '') ? parse(`${monthParam}-01`) : parse(browserToday.slice(0, 8) + '01')
  const view = searchParams.get('view') === 'list' ? 'list' : 'month'
  const selected = searchParams.get('day')
  const category = searchParams.get('category') ?? ''
  const owner = searchParams.get('owner') ?? ''
  const location = searchParams.get('location') ?? ''
  const hidden = new Set((searchParams.get('hide') ?? '').split(',').filter(Boolean))
  const types = TYPE_FILTERS.map((filter) => filter.value).filter((type) => !hidden.has(type))

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  // Six full weeks around the month, so the grid never has gaps.
  const gridStart = startOfWeek(anchor)
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  const params: CalendarParams = {
    start: iso(days[0]!),
    end: iso(days[41]!),
    types: types.length === TYPE_FILTERS.length ? undefined : (types as CalendarEventType[]),
    category: category || undefined,
    owner: owner || undefined,
    location: location || undefined,
  }

  const calendar = useQuery({
    queryKey: insightKeys.calendar(organization.id, params),
    queryFn: () => calendarService.range(organization.id, params),
    placeholderData: keepPreviousData,
    enabled: types.length > 0,
  })
  const members = useQuery({ queryKey: queryKeys.members(organization.id), queryFn: () => memberService.list(organization.id) })
  const locations = useQuery({
    queryKey: entityKeys.lookup(organization.id, 'location'),
    queryFn: () => entityService.lookup(organization.id, { type: 'location' }),
  })

  const todayIso = calendar.data?.today ?? browserToday
  const events = types.length > 0 ? (calendar.data?.events ?? []) : []
  const byDay = new Map<string, CalendarEvent[]>()
  for (const event of events) byDay.set(event.date, [...(byDay.get(event.date) ?? []), event])

  const month = anchor.getMonth()
  const shiftMonth = (delta: number) => {
    const next = new Date(anchor.getFullYear(), month + delta, 1)
    update({ month: iso(next).slice(0, 7), day: null })
  }
  const listEvents = events.filter((event) => parse(event.date).getMonth() === month)
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : []

  return (
    <>
      <PageHeader
        title="Compliance calendar"
        description="Expiry dates, renewal deadlines and approvals, all in one place."
        actions={
          <div className="flex rounded-md border bg-card p-0.5" role="group" aria-label="View">
            {(['month', 'list'] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={view === option ? 'secondary' : 'ghost'}
                aria-pressed={view === option}
                onClick={() => update({ view: option === 'month' ? null : option })}
              >
                {option === 'month' ? <CalendarDays aria-hidden /> : <List aria-hidden />}
                {option === 'month' ? 'Month' : 'List'}
              </Button>
            ))}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
          <h2 className="ml-2 min-w-40 text-base font-semibold" aria-live="polite">
            {monthTitle.format(anchor)}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => update({ month: null, day: todayIso })}>
            Today
          </Button>
        </div>

        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="sr-only">Show</legend>
          {TYPE_FILTERS.map((filter) => (
            <label key={filter.value} className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox
                checked={!hidden.has(filter.value)}
                onCheckedChange={(checked) => {
                  const next = new Set(hidden)
                  if (checked) next.delete(filter.value)
                  else next.add(filter.value)
                  update({ hide: [...next].join(',') || null })
                }}
              />
              <span className={cn('size-2 rounded-full', EVENT_STYLES[filter.value].dot)} aria-hidden />
              {filter.label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <NativeSelect aria-label="Document type" value={category} onChange={(event) => update({ category: event.target.value || null })}>
          <option value="">All document types</option>
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Person" value={owner} onChange={(event) => update({ owner: event.target.value || null })}>
          <option value="">Everyone</option>
          {(members.data ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.user.full_name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Location" value={location} onChange={(event) => update({ location: event.target.value || null })}>
          <option value="">All locations</option>
          {(locations.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {calendar.isError ? (
        <Card>
          <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />
        </Card>
      ) : calendar.isPending && types.length > 0 ? (
        <Skeleton className="h-[560px]" />
      ) : view === 'list' ? (
        <Card className={calendar.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}>
          {listEvents.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing this month"
              description="No expiry dates, renewal deadlines or approvals match these filters."
            />
          ) : (
            <ol className="divide-y">
              {[...new Set(listEvents.map((event) => event.date))].map((date) => (
                <li key={date} className="grid gap-1 px-2 py-2 sm:grid-cols-[150px_1fr]">
                  <p className={cn('px-3 pt-2.5 text-[13px] font-medium', date === todayIso && 'text-brand')}>
                    {dayTitle.format(parse(date))}
                  </p>
                  <ul>
                    {(byDay.get(date) ?? []).map((event) => (
                      <EventRow key={event.id} event={event} slug={organization.slug} categoryLabel={categoryLabel} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <Card className={cn('overflow-hidden', calendar.isPlaceholderData && 'opacity-70 transition-opacity')}>
            <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
              {days.slice(0, 7).map((day) => (
                <div key={iso(day)} className="py-2">
                  {weekdayShort.format(day)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const key = iso(day)
                const dayEvents = byDay.get(key) ?? []
                const outside = day.getMonth() !== month
                const isToday = key === todayIso
                return (
                  <div
                    key={key}
                    className={cn(
                      'min-h-24 border-b border-r p-1.5 text-left',
                      index % 7 === 6 && 'border-r-0',
                      index >= 35 && 'border-b-0',
                      outside && 'bg-muted/30',
                      selected === key && 'ring-2 ring-inset ring-brand/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => update({ day: selected === key ? null : key })}
                      className={cn(
                        'mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular-nums hover:bg-accent',
                        outside ? 'text-muted-foreground' : 'font-medium',
                        isToday && 'bg-brand text-brand-foreground hover:bg-brand/90',
                      )}
                      aria-label={`${dayTitle.format(day)}: ${dayEvents.length} ${dayEvents.length === 1 ? 'item' : 'items'}`}
                      aria-pressed={selected === key}
                    >
                      {day.getDate()}
                    </button>
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <EventChip key={event.id} event={event} slug={organization.slug} />
                      ))}
                      {dayEvents.length > 3 && (
                        <button
                          type="button"
                          onClick={() => update({ day: key })}
                          className="px-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          {dayEvents.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="h-fit">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">{selected ? dayTitle.format(parse(selected)) : 'Choose a day'}</p>
              <p className="text-xs text-muted-foreground">
                {selected
                  ? `${selectedEvents.length} ${selectedEvents.length === 1 ? 'item' : 'items'}`
                  : 'Select a date to see everything due on it.'}
              </p>
            </div>
            {selected &&
              (selectedEvents.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing due on this day.</p>
              ) : (
                <ul className="p-1.5">
                  {selectedEvents.map((event) => (
                    <EventRow key={event.id} event={event} slug={organization.slug} categoryLabel={categoryLabel} />
                  ))}
                </ul>
              ))}
            <div className="flex flex-col gap-1.5 border-t px-4 py-3">
              {Object.entries(EVENT_STYLES).map(([type, style]) => (
                <p key={type} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn('size-2 rounded-full', style.dot)} aria-hidden />
                  {type === 'expiry' ? 'Expires' : type === 'expired' ? 'Expired' : style.label}
                </p>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
