import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { EmptyState, ErrorState, Spinner } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/hooks/useOrganization'
import { cn, formatRelative } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { lifecycleKeys, notificationService } from '@/services/lifecycle'
import type { AppNotification } from '@/types/api'

/** Bell in the header: unread count, the latest notifications, and a way to open each one. */
export function NotificationBell() {
  const { organization } = useOrganization()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const unread = useQuery({
    queryKey: lifecycleKeys.unread(organization.id),
    queryFn: () => notificationService.unreadCount(organization.id),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const list = useQuery({
    queryKey: lifecycleKeys.notifications(organization.id),
    queryFn: () => notificationService.list(organization.id, { page_size: 15 }),
    enabled: open,
  })

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.unread(organization.id) }),
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.notifications(organization.id) }),
    ])

  const readAll = useMutation({
    mutationFn: () => notificationService.markAllRead(organization.id),
    onSuccess: refresh,
  })

  const openItem = async (item: AppNotification) => {
    setOpen(false)
    if (!item.read_at) {
      void notificationService.markRead(organization.id, item.id).then(refresh)
    }
    if (item.link) navigate(`${paths.org(organization.slug).root}/${item.link}`)
  }

  const count = unread.data?.unread ?? 0

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        >
          <Bell className="size-[18px]" aria-hidden />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-popover shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <Button variant="ghost" size="sm" loading={readAll.isPending} onClick={() => readAll.mutate()}>
                <CheckCheck aria-hidden />
                Mark all read
              </Button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {list.isPending ? (
              <div className="flex justify-center py-8" role="status" aria-label="Loading">
                <Spinner />
              </div>
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => void list.refetch()} className="py-6" />
            ) : list.data.items.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No notifications"
                description="Expiry reminders and renewal updates will appear here."
                className="py-8"
              />
            ) : (
              <ul className="divide-y">
                {list.data.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openItem(item)}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                        !item.read_at && 'bg-brand-soft/50',
                      )}
                    >
                      <span
                        className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.read_at ? 'bg-transparent' : 'bg-brand')}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium leading-5">{item.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatRelative(item.created_at)}
                          {!item.read_at && <span className="sr-only">, unread</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
