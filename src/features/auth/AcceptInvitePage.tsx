import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { Notice, PageLoader } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { ApiError, errorMessage } from '@/lib/http'
import { ROLE_LABELS } from '@/lib/permissions'
import { paths, withNext } from '@/routes/paths'
import { invitationService, queryKeys } from '@/services/organizations'
import type { InvitationPreview } from '@/types/api'

import { useAuth } from './AuthProvider'

const CLOSED_MESSAGES: Record<Exclude<InvitationPreview['status'], 'pending'>, { title: string; text: string }> = {
  expired: {
    title: 'This invitation has expired',
    text: 'Ask the person who invited you to send a new one.',
  },
  revoked: {
    title: 'This invitation was withdrawn',
    text: 'Ask the person who invited you if you still need access.',
  },
  accepted: {
    title: 'This invitation has already been used',
    text: 'If you accepted it, sign in to open the organization.',
  },
}

/** Landing page for the link in an invitation email. Works signed in or out. */
export function AcceptInvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { status, user, logout, reload } = useAuth()

  const preview = useQuery({
    queryKey: queryKeys.invitationPreview(token),
    queryFn: () => invitationService.preview(token),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const accept = useMutation({
    mutationFn: () => invitationService.accept(token),
    onSuccess: async (organization) => {
      await reload()
      navigate(paths.org(organization.slug).overview, { replace: true })
    },
  })

  const signOut = useMutation({ mutationFn: logout })

  if (preview.isPending || status === 'loading') return <PageLoader label="Loading invitation" />

  if (preview.isError) {
    const notFound = preview.error instanceof ApiError && preview.error.status === 404
    return (
      <AuthLayout title="Invitation">
        <Notice variant="error" title={notFound ? 'This invitation link is not valid' : 'The invitation could not be loaded'}>
          {notFound
            ? 'The link may be incomplete, or a newer invitation was sent. Use the link from the latest email.'
            : errorMessage(preview.error)}
        </Notice>
        <div className="mt-4 flex gap-2">
          {!notFound && <Button onClick={() => void preview.refetch()}>Try again</Button>}
          <Button asChild variant="outline">
            <Link to={paths.home}>Go to NOVALYN</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  const invitation = preview.data
  const here = paths.invite(token)

  if (invitation.status !== 'pending') {
    const message = CLOSED_MESSAGES[invitation.status]
    return (
      <AuthLayout title="Invitation">
        <Notice variant="warning" title={message.title}>
          {message.text}
        </Notice>
        <Button asChild variant="outline" className="mt-4">
          <Link to={paths.home}>{status === 'authenticated' ? 'Go to NOVALYN' : 'Sign in'}</Link>
        </Button>
      </AuthLayout>
    )
  }

  const summary = (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organization</p>
      <p className="mt-1 text-base font-semibold">{invitation.organization_name}</p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13px]">
        <dt className="text-muted-foreground">Your role</dt>
        <dd className="font-medium">{ROLE_LABELS[invitation.role]}</dd>
        <dt className="text-muted-foreground">Invited address</dt>
        <dd className="truncate font-medium">{invitation.email}</dd>
        {invitation.invited_by_name && (
          <>
            <dt className="text-muted-foreground">Invited by</dt>
            <dd className="font-medium">{invitation.invited_by_name}</dd>
          </>
        )}
      </dl>
    </div>
  )

  if (status !== 'authenticated' || !user) {
    return (
      <AuthLayout
        title={`Join ${invitation.organization_name}`}
        description="You have been invited to NOVALYN. Create an account or sign in to accept."
      >
        {summary}
        <div className="mt-5 flex flex-col gap-2">
          <Button asChild size="lg">
            <Link to={withNext(paths.register, here, { email: invitation.email })}>Create account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={withNext(paths.login, here, { email: invitation.email })}>I already have an account</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (user.email !== invitation.email) {
    return (
      <AuthLayout title={`Join ${invitation.organization_name}`}>
        {summary}
        <Notice variant="warning" title="You are signed in with a different address" className="mt-4">
          This invitation is for <span className="font-medium">{invitation.email}</span>, and you are signed in
          as <span className="font-medium">{user.email}</span>. Sign out and continue with the invited address.
        </Notice>
        {signOut.isError && (
          <Notice variant="error" className="mt-3">
            {errorMessage(signOut.error)}
          </Notice>
        )}
        <Button className="mt-4" loading={signOut.isPending} onClick={() => signOut.mutate()}>
          Sign out
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={`Join ${invitation.organization_name}`}
      description={`You are signed in as ${user.email}.`}
    >
      {summary}
      {accept.isError && (
        <Notice variant="error" className="mt-4">
          {errorMessage(accept.error)}
        </Notice>
      )}
      <Button size="lg" className="mt-5 w-full" loading={accept.isPending} onClick={() => accept.mutate()}>
        Accept invitation
      </Button>
    </AuthLayout>
  )
}
