import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormField } from '@/components/shared/misc'
import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { applyFieldErrors } from '@/features/auth/schemas'
import { EntityPicker, MemberPicker, Textarea } from '@/features/documents/controls'
import { ENTITY_TYPE_LABELS, ENTITY_TYPES } from '@/features/documents/shared'
import { errorMessage } from '@/lib/http'
import { entityService } from '@/services/documents'
import type { Entity, EntityType } from '@/types/api'

const schema = z.object({
  type: z.enum(['employee', 'supplier', 'equipment', 'location', 'department']),
  name: z.string().trim().min(1, 'Enter a name').max(200, 'Use at most 200 characters'),
  code: z.string().max(100, 'Use at most 100 characters'),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]),
  phone: z.string().max(50, 'Use at most 50 characters'),
  contact_name: z.string().max(200, 'Use at most 200 characters'),
  address: z.string().max(1000, 'Use at most 1000 characters'),
  notes: z.string().max(5000, 'Use at most 5000 characters'),
  location_id: z.string(),
  department_id: z.string(),
  owner_membership_id: z.string(),
})
type Values = z.infer<typeof schema>

const FIELDS = [
  'type',
  'name',
  'code',
  'email',
  'phone',
  'contact_name',
  'address',
  'notes',
  'location_id',
  'department_id',
  'owner_membership_id',
] as const

const CODE_LABEL: Record<EntityType, string> = {
  employee: 'Employee ID',
  supplier: 'Supplier code',
  equipment: 'Serial or asset number',
  location: 'Site code',
  department: 'Department code',
}

function toValues(entity: Entity | null, type: EntityType): Values {
  return {
    type: entity?.type ?? type,
    name: entity?.name ?? '',
    code: entity?.code ?? '',
    email: entity?.email ?? '',
    phone: entity?.phone ?? '',
    contact_name: entity?.contact_name ?? '',
    address: entity?.address ?? '',
    notes: entity?.notes ?? '',
    location_id: entity?.location?.id ?? '',
    department_id: entity?.department?.id ?? '',
    owner_membership_id: entity?.owner?.membership_id ?? '',
  }
}

interface EntityDialogProps {
  organizationId: string
  /** The record to edit, or null to create one. */
  entity: Entity | null
  defaultType: EntityType
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (entity: Entity) => Promise<unknown> | void
}

export function EntityDialog({ organizationId, entity, defaultType, open, onOpenChange, onSaved }: EntityDialogProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(entity, defaultType) })
  const type = watch('type')
  const isPerson = type === 'employee'
  const isOrganization = type === 'supplier'
  const canSitInLocation = type !== 'location'
  const canSitInDepartment = type !== 'department' && type !== 'location'

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const orNull = (value: string) => value.trim() || null
    const body = {
      name: values.name.trim(),
      code: orNull(values.code),
      email: orNull(values.email),
      phone: orNull(values.phone),
      contact_name: isOrganization ? orNull(values.contact_name) : null,
      address: orNull(values.address),
      notes: orNull(values.notes),
      location_id: canSitInLocation ? values.location_id || null : null,
      department_id: canSitInDepartment ? values.department_id || null : null,
      owner_membership_id: values.owner_membership_id || null,
    }
    try {
      const saved = entity
        ? await entityService.update(organizationId, entity.id, body)
        : await entityService.create(organizationId, { ...body, type: values.type })
      await onSaved(saved)
      toast.success(entity ? 'Changes saved.' : `${saved.name} added.`)
      onOpenChange(false)
    } catch (error) {
      if (!applyFieldErrors(error, setError, FIELDS)) setFormError(errorMessage(error))
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entity ? `Edit ${entity.name}` : `Add ${ENTITY_TYPE_LABELS[type].singular.toLowerCase()}`}</DialogTitle>
          <DialogDescription>
            Documents can be attached to this record, and its page lists them with their expiry dates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && <Notice variant="error">{formError}</Notice>}
          <div className="grid gap-4 sm:grid-cols-2">
            {!entity && (
              <FormField label="Kind of record" error={errors.type?.message}>
                {(field) => (
                  <NativeSelect {...field} {...register('type')}>
                    {ENTITY_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {ENTITY_TYPE_LABELS[value].singular}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
            <FormField label="Name" error={errors.name?.message} className={entity ? 'sm:col-span-2' : undefined}>
              {(field) => <Input maxLength={200} autoFocus {...field} {...register('name')} />}
            </FormField>
            <FormField label={CODE_LABEL[type]} error={errors.code?.message} hint="Optional.">
              {(field) => <Input {...field} {...register('code')} />}
            </FormField>
            {(isPerson || isOrganization) && (
              <FormField label="Email" error={errors.email?.message}>
                {(field) => <Input type="email" {...field} {...register('email')} />}
              </FormField>
            )}
            {(isPerson || isOrganization) && (
              <FormField label="Phone" error={errors.phone?.message}>
                {(field) => <Input type="tel" {...field} {...register('phone')} />}
              </FormField>
            )}
            {isOrganization && (
              <FormField label="Contact person" error={errors.contact_name?.message}>
                {(field) => <Input {...field} {...register('contact_name')} />}
              </FormField>
            )}
            {canSitInLocation && (
              <FormField label="Location" error={errors.location_id?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="location_id"
                    render={({ field: controller }) => (
                      <EntityPicker
                        {...field}
                        organizationId={organizationId}
                        types={['location']}
                        value={controller.value}
                        onChange={controller.onChange}
                        emptyLabel="No location"
                      />
                    )}
                  />
                )}
              </FormField>
            )}
            {canSitInDepartment && (
              <FormField label="Department" error={errors.department_id?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="department_id"
                    render={({ field: controller }) => (
                      <EntityPicker
                        {...field}
                        organizationId={organizationId}
                        types={['department']}
                        value={controller.value}
                        onChange={controller.onChange}
                        emptyLabel="No department"
                      />
                    )}
                  />
                )}
              </FormField>
            )}
            <FormField
              label="Responsible person"
              error={errors.owner_membership_id?.message}
              hint="The team member who looks after this record's documents."
            >
              {(field) => (
                <Controller
                  control={control}
                  name="owner_membership_id"
                  render={({ field: controller }) => (
                    <MemberPicker
                      {...field}
                      organizationId={organizationId}
                      value={controller.value}
                      onChange={controller.onChange}
                    />
                  )}
                />
              )}
            </FormField>
            {(isOrganization || type === 'location') && (
              <FormField label="Address" error={errors.address?.message} className="sm:col-span-2">
                {(field) => <Textarea rows={2} {...field} {...register('address')} />}
              </FormField>
            )}
            <FormField label="Notes" error={errors.notes?.message} className="sm:col-span-2">
              {(field) => <Textarea rows={3} {...field} {...register('notes')} />}
            </FormField>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={isSubmitting}>
              {entity ? 'Save changes' : 'Add record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
