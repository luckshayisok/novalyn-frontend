import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField } from '@/components/shared/misc'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, errorMessage } from '@/lib/http'
import { paths, safeNextPath, withNext } from '@/routes/paths'

import { useAuth } from './AuthProvider'
import { applyFieldErrors, PASSWORD_MIN_LENGTH, registerSchema, type RegisterValues } from './schemas'

export function RegisterPage() {
  const { register: createAccount } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', email: searchParams.get('email') ?? '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await createAccount(values)
      navigate(next ?? paths.home, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'email_taken') {
        setError('email', { type: 'server', message: 'An account with this email already exists.' })
        return
      }
      if (!applyFieldErrors(error, setError, ['full_name', 'email', 'password'])) {
        setFormError(errorMessage(error))
      }
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      description="Set up NOVALYN for your business in a few minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to={withNext(paths.login, next)} className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Notice variant="error">{formError}</Notice>}
        <FormField label="Full name" error={errors.full_name?.message}>
          {(field) => <Input autoComplete="name" autoFocus {...field} {...register('full_name')} />}
        </FormField>
        <FormField label="Work email" error={errors.email?.message}>
          {(field) => <Input type="email" autoComplete="email" {...field} {...register('email')} />}
        </FormField>
        <FormField
          label="Password"
          error={errors.password?.message}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        >
          {(field) => (
            <Input type="password" autoComplete="new-password" {...field} {...register('password')} />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1">
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
