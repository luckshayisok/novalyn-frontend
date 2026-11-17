import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField } from '@/components/shared/misc'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/http'
import { paths } from '@/routes/paths'
import { authService } from '@/services/auth'

import {
  applyFieldErrors,
  forgotPasswordSchema,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
} from './schemas'

const backToSignIn = (
  <Link to={paths.login} className="font-medium text-brand hover:underline">
    Back to sign in
  </Link>
)

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      await authService.forgotPassword(email)
      setSentTo(email)
    } catch (error) {
      setFormError(errorMessage(error))
    }
  })

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={backToSignIn}>
        <Notice variant="success" title="Reset link requested">
          If an account exists for <span className="font-medium">{sentTo}</span>, we have sent a link to reset
          the password. The link works once and expires after an hour.
        </Notice>
        <Button variant="outline" className="mt-4" onClick={() => setSentTo(null)}>
          Use a different email
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter the email you use for NOVALYN and we will send you a reset link."
      footer={backToSignIn}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Notice variant="error">{formError}</Notice>}
        <FormField label="Email" error={errors.email?.message}>
          {(field) => (
            <Input type="email" autoComplete="email" autoFocus {...field} {...register('email')} />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async ({ password }) => {
    if (!token) return
    setFormError(null)
    try {
      await authService.resetPassword({ token, password })
      setDone(true)
    } catch (error) {
      if (!applyFieldErrors(error, setError, ['password'])) setFormError(errorMessage(error))
    }
  })

  if (!token) {
    return (
      <AuthLayout title="Reset your password" footer={backToSignIn}>
        <Notice variant="error" title="This link is incomplete">
          Open the link from the reset email again, or request a new one.
        </Notice>
        <Button asChild variant="outline" className="mt-4">
          <Link to={paths.forgotPassword}>Request a new link</Link>
        </Button>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title="Password changed">
        <Notice variant="success" title="Your password has been changed">
          You have been signed out on every device. Sign in with the new password.
        </Notice>
        <Button asChild size="lg" className="mt-4">
          <Link to={paths.login}>Sign in</Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" footer={backToSignIn}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <Notice
            variant="error"
            action={
              <Link to={paths.forgotPassword} className="text-xs font-medium text-brand hover:underline">
                New link
              </Link>
            }
          >
            {formError}
          </Notice>
        )}
        <FormField
          label="New password"
          error={errors.password?.message}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        >
          {(field) => (
            <Input type="password" autoComplete="new-password" autoFocus {...field} {...register('password')} />
          )}
        </FormField>
        <FormField label="Confirm new password" error={errors.confirm?.message}>
          {(field) => (
            <Input type="password" autoComplete="new-password" {...field} {...register('confirm')} />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1">
          Change password
        </Button>
      </form>
    </AuthLayout>
  )
}
