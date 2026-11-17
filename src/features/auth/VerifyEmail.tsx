import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { Notice, PageLoader } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/http'
import { paths } from '@/routes/paths'
import { authService } from '@/services/auth'

import { useAuth } from './AuthProvider'

function useResendVerification() {
  return useMutation({
    mutationFn: authService.resendVerification,
    onSuccess: (result) => toast.success(result.message),
    onError: (error) => toast.error(errorMessage(error)),
  })
}

/** Shown inside the app while the signed-in user's email is unconfirmed. */
export function VerifyEmailBanner({ className }: { className?: string }) {
  const { user } = useAuth()
  const resend = useResendVerification()
  if (!user || user.is_email_verified) return null

  return (
    <Notice
      variant="warning"
      title="Confirm your email address"
      className={className}
      action={
        <Button variant="outline" size="sm" loading={resend.isPending} onClick={() => resend.mutate()}>
          Resend email
        </Button>
      }
    >
      We sent a confirmation link to <span className="font-medium">{user.email}</span>. You need to confirm
      it before you can invite other people.
    </Notice>
  )
}

/** Landing page for the link in the confirmation email. */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { status, reload } = useAuth()
  const resend = useResendVerification()

  // A query (not an effect + mutation) so that the request runs once per token,
  // including under React's development double-mount.
  const verification = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => authService.verifyEmail(token ?? ''),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const verified = verification.isSuccess
  useEffect(() => {
    if (verified && status === 'authenticated') void reload()
  }, [verified, status, reload])

  if (!token) {
    return (
      <AuthLayout title="Confirm your email">
        <Notice variant="error" title="This link is incomplete">
          Open the link from the confirmation email again.
        </Notice>
        <Button asChild variant="outline" className="mt-4">
          <Link to={paths.home}>Go to NOVALYN</Link>
        </Button>
      </AuthLayout>
    )
  }

  if (verification.isPending || status === 'loading') {
    return <PageLoader label="Confirming your email" />
  }

  if (verification.isError) {
    return (
      <AuthLayout title="Confirm your email">
        <Notice variant="error" title="This link did not work">
          {errorMessage(verification.error)}
        </Notice>
        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'authenticated' ? (
            <>
              <Button loading={resend.isPending} onClick={() => resend.mutate()}>
                Send a new link
              </Button>
              <Button asChild variant="outline">
                <Link to={paths.home}>Go to NOVALYN</Link>
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link to={paths.login}>Sign in to get a new link</Link>
            </Button>
          )}
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Email confirmed">
      <Notice variant="success" title="Thank you">
        <span className="font-medium">{verification.data.email}</span> is confirmed.
      </Notice>
      <Button asChild size="lg" className="mt-4">
        <Link to={status === 'authenticated' ? paths.home : paths.login}>
          {status === 'authenticated' ? 'Continue to NOVALYN' : 'Sign in'}
        </Link>
      </Button>
    </AuthLayout>
  )
}
