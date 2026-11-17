import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField } from '@/components/shared/misc'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/http'
import { paths, safeNextPath, withNext } from '@/routes/paths'

import { useAuth } from './AuthProvider'
import { loginSchema, type LoginValues } from './schemas'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: searchParams.get('email') ?? '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login(values)
      navigate(next ?? paths.home, { replace: true })
    } catch (error) {
      setFormError(errorMessage(error))
    }
  })

  return (
    <AuthLayout
      title="Sign in to NOVALYN"
      description="Enter your details to get back to your documents."
      footer={
        <>
          New to NOVALYN?{' '}
          <Link to={withNext(paths.register, next)} className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Notice variant="error">{formError}</Notice>}
        <FormField label="Email" error={errors.email?.message}>
          {(field) => (
            <Input type="email" autoComplete="email" autoFocus {...field} {...register('email')} />
          )}
        </FormField>
        <FormField
          label="Password"
          error={errors.password?.message}
          labelAction={
            <Link to={paths.forgotPassword} className="text-xs font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          }
        >
          {(field) => (
            <Input type="password" autoComplete="current-password" {...field} {...register('password')} />
          )}
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
