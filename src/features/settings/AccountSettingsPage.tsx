import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog, FormField, PageHeader } from '@/components/shared/misc'
import { Notice } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth, useCurrentUser } from '@/features/auth/AuthProvider'
import {
  applyFieldErrors,
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordValues,
} from '@/features/auth/schemas'
import { VerifyEmailBanner } from '@/features/auth/VerifyEmail'
import { errorMessage } from '@/lib/http'
import { paths } from '@/routes/paths'
import { authService } from '@/services/auth'

const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter your name').max(200, 'Use at most 200 characters'),
})
type ProfileValues = z.infer<typeof profileSchema>

function ProfileCard() {
  const user = useCurrentUser()
  const { reload } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user.full_name },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const updated = await authService.updateProfile(values)
      await reload()
      reset({ full_name: updated.full_name })
      toast.success('Profile saved.')
    } catch (error) {
      if (!applyFieldErrors(error, setError, ['full_name'])) setFormError(errorMessage(error))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your name as other members see it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {formError && <Notice variant="error">{formError}</Notice>}
          <FormField label="Full name" error={errors.full_name?.message} className="max-w-md">
            {(field) => <Input autoComplete="name" maxLength={200} {...field} {...register('full_name')} />}
          </FormField>
          <div className="flex max-w-md flex-col gap-1.5">
            <p className="text-[13px] font-medium">Email</p>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm">{user.email}</span>
              {user.is_email_verified ? (
                <Badge variant="success">Confirmed</Badge>
              ) : (
                <Badge variant="warning">Not confirmed</Badge>
              )}
            </div>
          </div>
          <VerifyEmailBanner />
        </CardContent>
        <CardFooter>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function PasswordCard() {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async ({ current_password, new_password }) => {
    setFormError(null)
    try {
      const result = await authService.changePassword({ current_password, new_password })
      reset()
      toast.success(result.message)
    } catch (error) {
      const placed = applyFieldErrors(error, setError, ['current_password', 'new_password'], {
        password: 'new_password',
      })
      if (!placed) setFormError(errorMessage(error))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing it signs you out on your other devices.</CardDescription>
        </CardHeader>
        <CardContent className="flex max-w-md flex-col gap-5">
          {formError && <Notice variant="error">{formError}</Notice>}
          <FormField label="Current password" error={errors.current_password?.message}>
            {(field) => (
              <Input type="password" autoComplete="current-password" {...field} {...register('current_password')} />
            )}
          </FormField>
          <FormField
            label="New password"
            error={errors.new_password?.message}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          >
            {(field) => (
              <Input type="password" autoComplete="new-password" {...field} {...register('new_password')} />
            )}
          </FormField>
          <FormField label="Confirm new password" error={errors.confirm?.message}>
            {(field) => <Input type="password" autoComplete="new-password" {...field} {...register('confirm')} />}
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" loading={isSubmitting}>
            Change password
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function SessionsCard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const signOutEverywhere = async () => {
    await authService.logoutAll()
    await logout()
    navigate(paths.login, { replace: true })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>
          Sign out of NOVALYN on every browser and device, including this one. Use this if you think someone
          else has access to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Sign out everywhere
        </Button>
      </CardContent>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out everywhere?"
        description="Every session ends immediately, including this one. You will need to sign in again."
        confirmLabel="Sign out everywhere"
        onConfirm={signOutEverywhere}
      />
    </Card>
  )
}

export function AccountSettingsPage() {
  return (
    <>
      <PageHeader title="Account" description="Your personal details and sign-in settings." />
      <div className="flex flex-col gap-6">
        <ProfileCard />
        <PasswordCard />
        <SessionsCard />
      </div>
    </>
  )
}
