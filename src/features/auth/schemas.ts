import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { z } from 'zod'

import { ApiError } from '@/lib/http'

export const PASSWORD_MIN_LENGTH = 10

const email = z.string().trim().min(1, 'Enter your email address').pipe(z.email('Enter a valid email address'))

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Use at most 128 characters')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter your name').max(200, 'Use at most 200 characters'),
  email,
  password: newPassword,
})
export type RegisterValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({ password: newPassword, confirm: z.string().min(1, 'Enter the password again') })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match',
  })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: newPassword,
    confirm: z.string().min(1, 'Enter the new password again'),
  })
  .refine((values) => values.new_password === values.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match',
  })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

/**
 * Put the API's per-field validation messages on the matching form fields.
 * Returns true when at least one message was placed, so the caller knows
 * whether a form-level message is still needed.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
  aliases: Partial<Record<string, Path<T>>> = {},
): boolean {
  if (!(error instanceof ApiError)) return false
  let placed = false
  for (const item of error.fieldErrors) {
    const target = aliases[item.field] ?? (fields.find((field) => field === item.field) as Path<T> | undefined)
    if (target) {
      setError(target, { type: 'server', message: item.message })
      placed = true
    }
  }
  return placed
}
