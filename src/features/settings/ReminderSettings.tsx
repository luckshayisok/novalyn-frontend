import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Notice } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthProvider'
import { useOrganization } from '@/hooks/useOrganization'
import { errorMessage } from '@/lib/http'
import { organizationService } from '@/services/organizations'

const DEFAULT_OFFSETS = [60, 30, 7, 1, 0]
const MAX_OFFSETS = 10

function describe(days: number): string {
  if (days === 0) return 'On the expiry day'
  return `${days} day${days === 1 ? '' : 's'} before`
}

/** When expiry reminders go out, for the whole organization. */
export function ReminderSettings() {
  const { organization, can } = useOrganization()
  const { reload } = useAuth()
  const editable = can('organization:update')
  const [enabled, setEnabled] = useState(organization.reminders_enabled)
  const [offsets, setOffsets] = useState<number[]>(organization.reminder_offsets)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...offsets].sort((a, b) => b - a)
  const dirty =
    enabled !== organization.reminders_enabled ||
    sorted.join() !== [...organization.reminder_offsets].sort((a, b) => b - a).join()

  const add = () => {
    const days = Number(draft)
    if (draft.trim() === '' || !Number.isInteger(days) || days < 0 || days > 365) {
      setDraftError('Enter a whole number of days from 0 to 365.')
      return
    }
    if (offsets.includes(days)) {
      setDraftError('That reminder is already in the list.')
      return
    }
    setOffsets([...offsets, days])
    setDraft('')
    setDraftError(null)
  }

  const save = async () => {
    setPending(true)
    setError(null)
    try {
      const updated = await organizationService.update(organization.id, {
        reminders_enabled: enabled,
        reminder_offsets: sorted,
      })
      await reload()
      setOffsets(updated.reminder_offsets)
      toast.success('Reminder settings saved.')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Expiry reminders</CardTitle>
        <CardDescription>
          Owners, admins, compliance managers and the person responsible for a document are reminded by email and
          in the app. Each reminder is sent once, then weekly alerts follow for expired documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error && <Notice variant="error">{error}</Notice>}
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox checked={enabled} disabled={!editable} onCheckedChange={(next) => setEnabled(next === true)} />
          Send expiry reminders
        </label>

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium">Remind</p>
          {sorted.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No reminders before expiry. Alerts are still sent once a document has expired.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {sorted.map((days) => (
                <li
                  key={days}
                  className="flex h-8 items-center gap-1.5 rounded-md border bg-card pl-3 pr-1 text-[13px]"
                >
                  {describe(days)}
                  {editable && (
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Remove the reminder ${describe(days).toLowerCase()}`}
                      onClick={() => setOffsets(offsets.filter((value) => value !== days))}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {editable && sorted.length < MAX_OFFSETS && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-reminder">Add a reminder</Label>
            <div className="flex max-w-xs items-start gap-2">
              <Input
                id="new-reminder"
                type="number"
                min={0}
                max={365}
                placeholder="Days before expiry"
                value={draft}
                aria-invalid={Boolean(draftError)}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    add()
                  }
                }}
              />
              <Button variant="outline" onClick={add}>
                <Plus aria-hidden />
                Add
              </Button>
            </div>
            {draftError && <p className="text-xs text-destructive">{draftError}</p>}
          </div>
        )}
      </CardContent>
      {editable && (
        <CardFooter>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setEnabled(true)
              setOffsets(DEFAULT_OFFSETS)
            }}
          >
            Use defaults
          </Button>
          <Button loading={pending} disabled={!dirty} onClick={() => void save()}>
            Save reminders
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
