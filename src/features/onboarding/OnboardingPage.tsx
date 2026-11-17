import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, MailCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Logo } from '@/components/shared/Logo'
import { FormField } from '@/components/shared/misc'
import { ErrorState, Notice, PageLoader } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthProvider'
import { VerifyEmailBanner } from '@/features/auth/VerifyEmail'
import { DropZone } from '@/features/documents/controls'
import { fileProblem, formatBytes } from '@/features/documents/shared'
import { InviteForm } from '@/features/team/InviteForm'
import { ApiError, errorMessage } from '@/lib/http'
import { ROLE_LABELS } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { documentService } from '@/services/documents'
import { invitationService, organizationService, queryKeys } from '@/services/organizations'
import type { Option, Organization, OrganizationUpdate } from '@/types/api'

const STEPS = ['Organization', 'Industry', 'Company size', 'Documents', 'Team', 'First document'] as const

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

/** Create the organization; if the server does not know the browser's time zone, fall back to UTC. */
async function createOrganization(name: string): Promise<Organization> {
  const timezone = browserTimezone()
  try {
    return await organizationService.create({ name, timezone })
  } catch (error) {
    const timezoneRejected =
      error instanceof ApiError && error.fieldErrors.some((item) => item.field === 'timezone')
    if (!timezone || !timezoneRejected) throw error
    return organizationService.create({ name })
  }
}

function Progress({ step }: { step: number }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      <div className="mt-2 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        {STEPS.map((label, index) => (
          <span
            key={label}
            className={cn('h-1 flex-1 rounded-full', index <= step ? 'bg-brand' : 'bg-border')}
          />
        ))}
      </div>
    </div>
  )
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-6">
      <h1 className="text-xl font-semibold leading-7">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

interface ChoiceListProps {
  label: string
  options: Option[]
  value: string | null
  onChange: (value: string) => void
  columns?: boolean
}

function ChoiceList({ label, options, value, onChange, columns = false }: ChoiceListProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('mt-5 grid gap-2', columns && 'sm:grid-cols-2')}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-11 items-center justify-between rounded-md border bg-card px-3.5 text-left text-sm transition-colors',
              selected ? 'border-brand bg-brand-soft font-medium text-foreground' : 'hover:bg-accent',
            )}
          >
            {option.label}
            {selected && <Check className="size-4 text-brand" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

interface StepActionsProps {
  onBack?: () => void
  onSkip?: () => void
  primary: ReactNode
}

function StepActions({ onBack, onSkip, primary }: StepActionsProps) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      <div>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onSkip && (
          <Button variant="ghost" onClick={onSkip}>
            Skip this step
          </Button>
        )}
        {primary}
      </div>
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { organizations, reload, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const organization = organizations.find((item) => item.slug === searchParams.get('org')) ?? null

  // Resuming an unfinished setup starts at the first step that still needs an answer.
  const [step, setStep] = useState(() => {
    if (!organization) return 0
    if (!organization.industry) return 1
    if (!organization.company_size) return 2
    if (organization.document_categories.length === 0) return 3
    return 4
  })
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(organization?.industry ?? null)
  const [companySize, setCompanySize] = useState<string | null>(organization?.company_size ?? null)
  const [categories, setCategories] = useState<string[]>(organization?.document_categories ?? [])

  const options = useQuery({
    queryKey: queryKeys.options,
    queryFn: organizationService.options,
    staleTime: Infinity,
  })

  const invitations = useQuery({
    queryKey: queryKeys.invitations(organization?.id ?? ''),
    queryFn: () => invitationService.list(organization?.id ?? ''),
    enabled: Boolean(organization) && step === 4,
  })

  const create = useMutation({
    mutationFn: createOrganization,
    onSuccess: async (created) => {
      await reload()
      setSearchParams({ org: created.slug }, { replace: true })
      setStep(1)
    },
  })

  const save = useMutation({
    mutationFn: async (changes: OrganizationUpdate) => {
      if (!organization) throw new Error('No organization to update')
      await organizationService.update(organization.id, changes)
      await reload()
    },
  })

  const finish = useMutation({
    mutationFn: async () => {
      if (!organization) throw new Error('No organization to finish')
      await organizationService.completeOnboarding(organization.id)
      await reload()
      return organization
    },
    onSuccess: (finished) => navigate(paths.org(finished.slug).overview, { replace: true }),
  })

  const saveAndContinue = (changes: OrganizationUpdate, changed: boolean) => {
    if (!changed) {
      setStep((current) => current + 1)
      return
    }
    save.mutate(changes, { onSuccess: () => setStep((current) => current + 1) })
  }

  const submitName = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Enter the name of your organization')
      return
    }
    setNameError(null)
    create.mutate(trimmed)
  }

  const goBack = () => {
    save.reset()
    setStep((current) => Math.max(1, current - 1))
  }
  const skip = () => {
    save.reset()
    setStep((current) => current + 1)
  }

  const stepError = save.isError ? save.error : finish.isError ? finish.error : null
  const needsOptions = step >= 1 && step <= 3

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-5 sm:px-8">
        <Logo />
        {organization ? (
          <Button variant="ghost" size="sm" loading={finish.isPending} onClick={() => finish.mutate()}>
            Skip setup
          </Button>
        ) : (
          organizations.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link to={paths.home}>Cancel</Link>
            </Button>
          )
        )}
      </header>

      <main className="flex flex-1 justify-center px-5 py-10">
        <div className="w-full max-w-[560px]">
          <div className="rounded-lg border bg-card p-6 sm:p-8">
            <Progress step={step} />

            {stepError !== null && (
              <Notice variant="error" className="mt-5">
                {errorMessage(stepError)}
              </Notice>
            )}

            {step === 0 && (
              <form onSubmit={submitName} noValidate>
                <StepHeading
                  title="Set up your organization"
                  description="This is the workspace your team will share. You can change the name later."
                />
                {create.isError && (
                  <Notice variant="error" className="mt-5">
                    {errorMessage(create.error)}
                  </Notice>
                )}
                <FormField label="Organization name" error={nameError ?? undefined} className="mt-5">
                  {(field) => (
                    <Input
                      autoFocus
                      autoComplete="organization"
                      maxLength={200}
                      placeholder="Acme Facilities Ltd"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      {...field}
                    />
                  )}
                </FormField>
                <StepActions
                  primary={
                    <Button type="submit" loading={create.isPending}>
                      Create organization
                    </Button>
                  }
                />
              </form>
            )}

            {needsOptions && options.isPending && <PageLoader label="Loading options" />}
            {needsOptions && options.isError && (
              <ErrorState error={options.error} onRetry={() => void options.refetch()} />
            )}

            {step === 1 && options.data && organization && (
              <>
                <StepHeading
                  title="What does your business do?"
                  description="Pick the closest match. It appears in your organization profile and can be changed later."
                />
                <ChoiceList
                  label="Industry"
                  options={options.data.industries}
                  value={industry}
                  onChange={setIndustry}
                  columns
                />
                <StepActions
                  onSkip={skip}
                  primary={
                    <Button
                      loading={save.isPending}
                      disabled={!industry}
                      onClick={() => saveAndContinue({ industry }, industry !== organization.industry)}
                    >
                      Continue
                    </Button>
                  }
                />
              </>
            )}

            {step === 2 && options.data && organization && (
              <>
                <StepHeading
                  title="How large is your company?"
                  description="Count everyone who works for the business, not only the people who will use NOVALYN."
                />
                <ChoiceList
                  label="Company size"
                  options={options.data.company_sizes}
                  value={companySize}
                  onChange={setCompanySize}
                />
                <StepActions
                  onBack={goBack}
                  onSkip={skip}
                  primary={
                    <Button
                      loading={save.isPending}
                      disabled={!companySize}
                      onClick={() =>
                        saveAndContinue({ company_size: companySize }, companySize !== organization.company_size)
                      }
                    >
                      Continue
                    </Button>
                  }
                />
              </>
            )}

            {step === 3 && options.data && organization && (
              <>
                <StepHeading
                  title="Which documents do you need to track?"
                  description="Choose every type you keep on file. You can change this in settings."
                />
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {options.data.document_categories.map((option) => {
                    const checked = categories.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-card px-3.5 py-2 text-sm transition-colors',
                          checked ? 'border-brand bg-brand-soft' : 'hover:bg-accent',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          aria-label={option.label}
                          onCheckedChange={(next) =>
                            setCategories((current) =>
                              next === true
                                ? [...current, option.value]
                                : current.filter((value) => value !== option.value),
                            )
                          }
                        />
                        {option.label}
                      </label>
                    )
                  })}
                </div>
                <StepActions
                  onBack={goBack}
                  onSkip={skip}
                  primary={
                    <Button
                      loading={save.isPending}
                      disabled={categories.length === 0}
                      onClick={() =>
                        saveAndContinue(
                          { document_categories: categories },
                          [...categories].sort().join() !== [...organization.document_categories].sort().join(),
                        )
                      }
                    >
                      Continue
                    </Button>
                  }
                />
              </>
            )}

            {step === 4 && organization && (
              <>
                <StepHeading
                  title="Invite your team"
                  description="Add the people who manage documents with you. Each invitation is sent by email and lasts seven days."
                />
                <VerifyEmailBanner className="mt-5" />
                <div className="mt-5">
                  <InviteForm
                    organization={organization}
                    layout="inline"
                    submitLabel="Send invitation"
                    disabled={!organization.permissions.includes('members:invite') || !user?.is_email_verified}
                  />
                </div>
                {invitations.isError && (
                  <Notice variant="error" className="mt-5">
                    {errorMessage(invitations.error)}
                  </Notice>
                )}
                {invitations.data && invitations.data.length > 0 && (
                  <ul className="mt-5 divide-y rounded-md border">
                    {invitations.data.map((invitation) => (
                      <li key={invitation.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                        <MailCheck className="size-4 shrink-0 text-success" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{invitation.email}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {ROLE_LABELS[invitation.role]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <StepActions
                  onBack={goBack}
                  primary={<Button onClick={() => setStep(5)}>Continue</Button>}
                />
              </>
            )}

            {step === 5 && organization && (
              <FirstDocumentStep
                organization={organization}
                categories={options.data?.document_categories ?? []}
                finishing={finish.isPending}
                onBack={goBack}
                onFinish={() => finish.mutate()}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

interface FirstDocumentStepProps {
  organization: Organization
  categories: Option[]
  finishing: boolean
  onBack: () => void
  onFinish: () => void
}

/** Optional last step: upload one document so the dashboard has something to show. */
function FirstDocumentStep({ organization, categories, finishing, onBack, onFinish }: FirstDocumentStepProps) {
  const preferred = categories.filter((option) => organization.document_categories.includes(option.value))
  const offered = preferred.length > 0 ? preferred : categories
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState(offered[0]?.value ?? '')
  const [expiryDate, setExpiryDate] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canUpload = organization.permissions.includes('documents:write')

  const choose = (files: File[]) => {
    const chosen = files[0]
    if (!chosen) return
    const problem = fileProblem(chosen)
    setError(problem)
    setFile(problem ? null : chosen)
  }

  const uploadAndFinish = async () => {
    if (!file || !category) return
    setError(null)
    setProgress(0)
    try {
      await documentService.upload(
        organization.id,
        file,
        { category, expiry_date: expiryDate || undefined },
        setProgress,
      )
      onFinish()
    } catch (caught) {
      setProgress(null)
      setError(errorMessage(caught))
    }
  }

  return (
    <>
      <StepHeading
        title="Upload your first document"
        description="Add one license, certificate, policy or permit now, or skip this and upload later."
      />
      {error && (
        <Notice variant="error" className="mt-5">
          {error}
        </Notice>
      )}
      {!canUpload ? (
        <Notice variant="info" className="mt-5">
          Your role does not allow uploading documents.
        </Notice>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-md border px-3.5 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
              </span>
              <Button variant="ghost" size="sm" disabled={progress !== null} onClick={() => setFile(null)}>
                Change
              </Button>
            </div>
          ) : (
            <DropZone onFiles={choose} multiple={false} compact />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Document type">
              {(field) => (
                <select
                  {...field}
                  value={category}
                  disabled={progress !== null}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {offered.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Expiry date" hint="Optional.">
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={expiryDate}
                  disabled={progress !== null}
                  onChange={(event) => setExpiryDate(event.target.value)}
                />
              )}
            </FormField>
          </div>
        </div>
      )}
      <StepActions
        onBack={onBack}
        onSkip={progress === null ? onFinish : undefined}
        primary={
          <Button
            loading={progress !== null || finishing}
            disabled={canUpload && !file}
            onClick={() => (canUpload ? void uploadAndFinish() : onFinish())}
          >
            {canUpload ? 'Upload and finish' : 'Finish setup'}
          </Button>
        }
      />
    </>
  )
}
