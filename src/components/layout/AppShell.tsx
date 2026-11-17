import {
  Boxes,
  Building2,
  Check,
  FileText,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Logo } from '@/components/shared/Logo'

import { GlobalSearch } from './GlobalSearch'
import { RoleBadge, UserAvatar } from '@/components/shared/misc'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth, useCurrentUser } from '@/features/auth/AuthProvider'
import { useOrganization } from '@/hooks/useOrganization'
import { errorMessage } from '@/lib/http'
import { cn } from '@/lib/utils'
import { paths, withNext } from '@/routes/paths'
import type { Permission } from '@/types/api'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  permission?: Permission
}

function useNavItems(): NavItem[] {
  const { organization, can } = useOrganization()
  const org = paths.org(organization.slug)
  const items: NavItem[] = [
    { label: 'Overview', to: org.overview, icon: LayoutDashboard },
    { label: 'Documents', to: org.documents, icon: FileText, permission: 'documents:read' },
    { label: 'Entities', to: org.entities, icon: Boxes, permission: 'entities:read' },
    { label: 'Team', to: org.team, icon: Users, permission: 'members:read' },
    { label: 'Audit Logs', to: org.auditLog, icon: ScrollText, permission: 'audit:read' },
    { label: 'Settings', to: org.settings, icon: Settings },
  ]
  return items.filter((item) => !item.permission || can(item.permission))
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const items = useNavItems()
  const { organization } = useOrganization()
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-5">
        <Link
          to={paths.org(organization.slug).overview}
          onClick={onNavigate}
          className="rounded-md"
          aria-label="NOVALYN overview"
        >
          <Logo tone="light" />
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <ul className="flex flex-col gap-0.5">
          {items.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white/60',
                    isActive
                      ? 'bg-sidebar-active text-white'
                      : 'text-sidebar-foreground hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="shrink-0 border-t border-sidebar-border px-5 py-4">
        <p className="truncate text-xs font-medium text-white">{organization.name}</p>
        <p className="mt-0.5 text-xs text-sidebar-muted">Every document. Every deadline.</p>
      </div>
    </div>
  )
}

function OrganizationSwitcher() {
  const { organizations } = useAuth()
  const { organization } = useOrganization()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 min-w-0 max-w-[260px] items-center gap-2 rounded-md border bg-card px-2.5 text-sm font-medium transition-colors hover:bg-accent"
          aria-label={`Organization: ${organization.name}. Switch organization`}
        >
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{organization.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {organizations.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onSelect={() => navigate(paths.org(item.slug).overview)}
            className="justify-between"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{item.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <RoleBadge role={item.role} />
              {item.id === organization.id && <Check className="!text-brand" aria-label="Current" />}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(withNext(paths.onboarding, null, { new: '1' }))}>
          <Plus aria-hidden />
          Create organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const { organization } = useOrganization()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    try {
      await logout()
      navigate(paths.login, { replace: true })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-accent"
          aria-label={`Account menu for ${user.full_name}`}
        >
          <UserAvatar name={user.full_name} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(paths.org(organization.slug).account)}>
          <UserRound aria-hidden />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 w-64 shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left lg:hidden"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Signed-in frame: sidebar navigation, header with organization switcher and account menu. */
export function AppShell({ children }: { children: ReactNode }) {
  // The mobile drawer closes itself when one of its links is followed.
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <SidebarNav />
      </aside>
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur-sm sm:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu />
        </Button>
        <OrganizationSwitcher />
        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
          <GlobalSearch />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
