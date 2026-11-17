import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { FormField } from '@/components/shared/misc'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { applyFieldErrors } from '@/features/auth/schemas'
import { errorMessage } from '@/lib/http'
import { invitableRoles, ROLE_LABELS } from '@/lib/permissions'
import { invitationService, organizationService, queryKeys } from '@/services/organizations'
import type { Invitation, Organization, Role } from '@/types/api'

const inviteSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email address').pipe(z.email('Enter a valid email address')),
  role: z.enum(['admin', 'compliance_manager', 'member', 'viewer']),
})
type InviteValues = z.infer<typeof inviteSchema>

interface InviteFormProps {
  organization: Organization
  disabled?: boolean
  submitLabel?: string
  onInvited?: (invitation: Invitation) => void
  /** Extra controls rendered next to the submit button (a Cancel button in a dialog). */
  secondaryAction?: ReactNode
  layout?: 'stacked' | 'inline'
}

/** Email and role fields that send one invitation. Used in the team page and in onboarding. */
export function InviteForm({
  organization,
  disabled = false,
  submitLabel = 'Send invitation',
  onInvited,
  secondaryAction,
  layout = 'stacked',
}: InviteFormProps) {
  const queryClient = useQueryClient()
  const roles = invitableRoles(organization.role)
  const [formError, setFormError] = useState<string | null>(null)

  const options = useQuery({
    queryKey: queryKeys.options,
    queryFn: organizationService.options,
    staleTime: Infinity,
  })
  const describe = (role: Role) => options.data?.roles.find((item) => item.value === role)?.description

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  })

  const invite = useMutation({
    mutationFn: (values: InviteValues) => invitationService.create(organization.id, values),
    onSuccess: async (invitation) => {
      reset({ email: '', role: invitation.role as InviteValues['role'] })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invitations(organization.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(organization.id) }),
      ])
      onInvited?.(invitation)
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError, ['email', 'role'])) setFormError(errorMessage(error))
    },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    invite.mutate(values)
  })

  const inline = layout === 'inline'

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Notice variant="error">{formError}</Notice>}
      <div className={inline ? 'grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]' : 'flex flex-col gap-4'}>
        <FormField label="Email address" error={errors.email?.message}>
          {(field) => (
            <Input
              type="email"
              autoComplete="off"
              placeholder="name@company.com"
              disabled={disabled}
              {...field}
              {...register('email')}
            />
          )}
        </FormField>
        <FormField label="Role" error={errors.role?.message}>
          {(field) => (
            <Controller
              control={control}
              name="role"
              render={({ field: controller }) => (
                <Select value={controller.value} onValueChange={controller.onChange} disabled={disabled}>
                  <SelectTrigger id={field.id} aria-invalid={field['aria-invalid']} onBlur={controller.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role} description={describe(role)} textValue={ROLE_LABELS[role]}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
      </div>
      <div className={inline ? 'flex justify-start gap-2' : 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'}>
        {secondaryAction}
        <Button type="submit" variant={inline ? 'outline' : 'default'} loading={invite.isPending} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
