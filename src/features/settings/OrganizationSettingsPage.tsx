import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog, FormField, PageHeader } from '@/components/shared/misc'
import { ErrorState, Notice, PageLoader } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox, NativeSelect } from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthProvider'
import { applyFieldErrors } from '@/features/auth/schemas'
import { useOrganization } from '@/hooks/useOrganization'
import { ReminderSettings } from './ReminderSettings'
import { errorMessage } from '@/lib/http'
import { formatDate } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { organizationService, queryKeys } from '@/services/organizations'
import type { Organization, OrganizationUpdate } from '@/types/api'

const settingsSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200, 'Use at most 200 characters'),
  industry: z.string(),
  company_size: z.string(),
  timezone: z.string().min(1, 'Choose a time zone'),
  document_categories: z.array(z.string()),
})
type SettingsValues = z.infer<typeof settingsSchema>

function toValues(organization: Organization): SettingsValues {
  return {
    name: organization.name,
    industry: organization.industry ?? '',
    company_size: organization.company_size ?? '',
    timezone: organization.timezone,
    document_categories: organization.document_categories,
  }
}

function timezones(current: string): string[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    // Older browsers: fall back to the current value and UTC.
  }
  return Array.from(new Set(['UTC', current, ...zones])).sort((a, b) => a.localeCompare(b))
}

export function OrganizationSettingsPage() {
  const { organization, can } = useOrganization()
  const { reload } = useAuth()
  const navigate = useNavigate()
  const editable = can('organization:update')
  const [formError, setFormError] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const canDelete = can('organization:delete')
  const scheduled = organization.deletion_scheduled_for

  const options = useQuery({
    queryKey: queryKeys.options,
    queryFn: organizationService.options,
    staleTime: Infinity,
  })
  const zones = useMemo(() => timezones(organization.timezone), [organization.timezone])

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toValues(organization),
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const changes: OrganizationUpdate = {
      name: values.name,
      industry: values.industry || null,
      company_size: values.company_size || null,
      timezone: values.timezone,
      document_categories: values.document_categories,
    }
    try {
      const updated = await organizationService.update(organization.id, changes)
      await reload()
      reset(toValues(updated))
      toast.success('Organization settings saved.')
    } catch (error) {
      const placed = applyFieldErrors(error, setError, [
        'name',
        'industry',
        'company_size',
        'timezone',
        'document_categories',
      ])
      if (!placed) setFormError(errorMessage(error))
    }
  })

  const leave = async () => {
    await organizationService.leave(organization.id)
    await reload()
    toast.success(`You left ${organization.name}.`)
    navigate(paths.home, { replace: true })
  }

  const scheduleDeletion = async () => {
    await organizationService.scheduleDeletion(organization.id, confirmName)
    await reload()
    setConfirmName('')
    toast.success('Deletion scheduled. Owners and admins have been emailed.')
  }

  const cancelDeletion = async () => {
    try {
      await organizationService.cancelDeletion(organization.id)
      await reload()
      toast.success('Deletion cancelled. Nothing will be erased.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  if (options.isPending) return <PageLoader label="Loading settings" />
  if (options.isError) return <ErrorState error={options.error} onRetry={() => void options.refetch()} />

  return (
    <>
      <PageHeader title="Settings" description="Profile and preferences for this organization." />

      <form onSubmit={onSubmit} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Organization profile</CardTitle>
            <CardDescription>How this organization is described across NOVALYN.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {!editable && (
              <Notice variant="info">Only owners and admins can change these settings.</Notice>
            )}
            {formError && <Notice variant="error">{formError}</Notice>}

            <FormField label="Organization name" error={errors.name?.message} className="max-w-md">
              {(field) => <Input disabled={!editable} maxLength={200} {...field} {...register('name')} />}
            </FormField>

            <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
              <FormField label="Industry" error={errors.industry?.message}>
                {(field) => (
                  <NativeSelect disabled={!editable} {...field} {...register('industry')}>
                    <option value="">Not set</option>
                    {options.data.industries.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <FormField label="Company size" error={errors.company_size?.message}>
                {(field) => (
                  <NativeSelect disabled={!editable} {...field} {...register('company_size')}>
                    <option value="">Not set</option>
                    {options.data.company_sizes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </div>

            <FormField
              label="Time zone"
              error={errors.timezone?.message}
              hint="The organization's local time, used for dates and deadlines."
              className="max-w-md"
            >
              {(field) => (
                <NativeSelect disabled={!editable} {...field} {...register('timezone')}>
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replaceAll('_', ' ')}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>

            <fieldset className="flex flex-col gap-2" disabled={!editable}>
              <legend className="text-[13px] font-medium">Document types you track</legend>
              <p className="text-xs text-muted-foreground">
                The kinds of documents this organization keeps on file.
              </p>
              <Controller
                control={control}
                name="document_categories"
                render={({ field }) => (
                  <div className="mt-1 grid max-w-2xl gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {options.data.document_categories.map((option) => {
                      const checked = field.value.includes(option.value)
                      return (
                        <label key={option.value} className="flex cursor-pointer items-center gap-2.5 text-sm">
                          <Checkbox
                            checked={checked}
                            aria-label={option.label}
                            disabled={!editable}
                            onCheckedChange={(next) =>
                              field.onChange(
                                next === true
                                  ? [...field.value, option.value]
                                  : field.value.filter((value) => value !== option.value),
                              )
                            }
                          />
                          {option.label}
                        </label>
                      )
                    })}
                  </div>
                )}
              />
            </fieldset>
          </CardContent>
          {editable && (
            <CardFooter>
              <Button
                variant="ghost"
                disabled={!isDirty || isSubmitting}
                onClick={() => {
                  reset(toValues(organization))
                  setFormError(null)
                }}
              >
                Discard changes
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Save changes
              </Button>
            </CardFooter>
          )}
        </Card>
      </form>

      <ReminderSettings />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Leave organization</CardTitle>
          <CardDescription>
            You lose access to {organization.name} immediately. To come back, someone has to invite you again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-destructive hover:bg-destructive-soft" onClick={() => setLeaveOpen(true)}>
            Leave {organization.name}
          </Button>
        </CardContent>
      </Card>

      {canDelete && (
        <Card className="mt-6 border-destructive/30">
          <CardHeader>
            <CardTitle>Delete organization</CardTitle>
            <CardDescription>
              Erases every document, file, record and the activity history of {organization.name} after a
              30-day grace period. Accounts of members are not deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduled ? (
              <Notice
                variant="warning"
                title={`Scheduled for deletion on ${formatDate(scheduled)}`}
                action={
                  <Button variant="outline" size="sm" onClick={() => void cancelDeletion()}>
                    Cancel deletion
                  </Button>
                }
              >
                Until then everything keeps working, and any owner can cancel.
              </Notice>
            ) : (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete {organization.name}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setConfirmName('')
        }}
        title={`Delete ${organization.name}?`}
        description={
          <div className="flex flex-col gap-3">
            <p>
              In 30 days every document, file and record of this organization is erased for good. Owners and
              admins are emailed now, and any owner can cancel until then. If you pay for a plan, cancel it on
              the billing page first.
            </p>
            <FormField label={`Type ${organization.name} to confirm`}>
              {(field) => (
                <Input {...field} value={confirmName} autoComplete="off" onChange={(event) => setConfirmName(event.target.value)} />
              )}
            </FormField>
          </div>
        }
        confirmLabel="Schedule deletion"
        destructive
        onConfirm={scheduleDeletion}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={`Leave ${organization.name}?`}
        description="You lose access immediately. To come back, someone has to invite you again."
        confirmLabel="Leave"
        destructive
        onConfirm={leave}
      />
    </>
  )
}
