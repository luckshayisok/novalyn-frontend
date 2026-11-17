import { Compass, Lock } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams, useRouteError, useSearchParams } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { Logo } from '@/components/shared/Logo'
import { EmptyState, ErrorState, PageLoader } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'
import { OrganizationProvider, useOrganization } from '@/hooks/useOrganization'
import type { Permission } from '@/types/api'

import { lastOrganization, paths, rememberOrganization, safeNextPath, withNext } from './paths'

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-5">
      <Logo />
      <div className="w-full max-w-md rounded-lg border bg-card">{children}</div>
    </div>
  )
}

/** Shown while the session is being restored, or when the server cannot be reached to restore it. */
function SessionGate({ children }: { children: ReactNode }) {
  const { status, bootstrapError, retryBootstrap } = useAuth()
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen">
        <PageLoader label="Loading NOVALYN" />
      </div>
    )
  }
  if (bootstrapError) {
    return (
      <Centered>
        <ErrorState error={bootstrapError} title="NOVALYN could not be loaded" onRetry={retryBootstrap} />
      </Centered>
    )
  }
  return <>{children}</>
}

/** `/` sends people to the right place for their state. */
export function IndexRedirect() {
  const { status, organizations } = useAuth()
  return (
    <SessionGate>
      {status !== 'authenticated' ? (
        <Navigate to={paths.login} replace />
      ) : organizations.length === 0 ? (
        <Navigate to={paths.onboarding} replace />
      ) : (
        <Navigate
          to={
            paths.org(
              (organizations.find((item) => item.slug === lastOrganization()) ?? organizations[0]).slug,
            ).overview
          }
          replace
        />
      )}
    </SessionGate>
  )
}

/** Routes for signed-in users. Others are sent to sign in and brought back afterwards. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  return (
    <SessionGate>
      {status === 'authenticated' ? (
        <Outlet />
      ) : (
        <Navigate to={withNext(paths.login, location.pathname + location.search)} replace />
      )}
    </SessionGate>
  )
}

/** Routes that make no sense when signed in (sign in, register). */
export function GuestOnly() {
  const { status } = useAuth()
  const [searchParams] = useSearchParams()
  return (
    <SessionGate>
      {status === 'authenticated' ? (
        <Navigate to={safeNextPath(searchParams.get('next')) ?? paths.home} replace />
      ) : (
        <Outlet />
      )}
    </SessionGate>
  )
}

/** Public routes that still need the session state resolved first. */
export function SessionAware() {
  return (
    <SessionGate>
      <Outlet />
    </SessionGate>
  )
}

/** Resolves `/o/:orgSlug` to one of the user's organizations and renders the app shell. */
export function OrganizationLayout() {
  const { orgSlug } = useParams()
  const { organizations } = useAuth()
  const organization = organizations.find((item) => item.slug === orgSlug)

  useEffect(() => {
    if (organization) rememberOrganization(organization.slug)
  }, [organization])

  if (!organization) {
    return (
      <Centered>
        <EmptyState
          icon={Compass}
          title="Organization not found"
          description="It does not exist, or you are not a member of it."
          action={
            <Button asChild>
              <Link to={paths.home}>Go to your organization</Link>
            </Button>
          }
        />
      </Centered>
    )
  }

  if (!organization.onboarding_completed_at && organization.permissions.includes('organization:update')) {
    // Setup was started but not finished: resume the wizard where it can be skipped.
    return <Navigate to={withNext(paths.onboarding, null, { org: organization.slug })} replace />
  }

  return (
    <OrganizationProvider organization={organization}>
      <AppShell>
        <Outlet />
      </AppShell>
    </OrganizationProvider>
  )
}

/** Wraps a page that needs a permission; shows a clear message instead of a broken page. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { organization, can } = useOrganization()
  if (can(permission)) return <>{children}</>
  return (
    <div className="rounded-lg border bg-card">
      <EmptyState
        icon={Lock}
        title="You do not have access to this page"
        description="Your role in this organization does not include it. Ask an owner or admin if you need access."
        action={
          <Button asChild variant="outline">
            <Link to={paths.org(organization.slug).overview}>Back to overview</Link>
          </Button>
        }
      />
    </div>
  )
}

export function NotFoundInApp() {
  const { organization } = useOrganization()
  return (
    <div className="rounded-lg border bg-card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The address may be mistyped, or the page may have moved."
        action={
          <Button asChild variant="outline">
            <Link to={paths.org(organization.slug).overview}>Back to overview</Link>
          </Button>
        }
      />
    </div>
  )
}

export function NotFoundPage() {
  return (
    <Centered>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The address may be mistyped, or the page may have moved."
        action={
          <Button asChild>
            <Link to={paths.home}>Go to NOVALYN</Link>
          </Button>
        }
      />
    </Centered>
  )
}

/** Last-resort screen when a page throws while rendering. */
export function RouteErrorPage() {
  const error = useRouteError()
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <Centered>
      <ErrorState
        error={null}
        title="Something went wrong on this page"
        onRetry={() => window.location.reload()}
      />
    </Centered>
  )
}
