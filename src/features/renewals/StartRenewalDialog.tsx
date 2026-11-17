import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

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
import { MemberPicker, Textarea } from '@/features/documents/controls'
import { useOrganization } from '@/hooks/useOrganization'
import { ApiError, errorMessage } from '@/lib/http'
import { paths } from '@/routes/paths'
import { renewalService } from '@/services/lifecycle'
import type { DocumentDetail } from '@/types/api'

import { useRefreshRenewals } from './shared'

interface StartRenewalDialogProps {
  document: DocumentDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Create a renewal for a document and, usually, ask someone to do it. */
export function StartRenewalDialog({ document, open, onOpenChange }: StartRenewalDialogProps) {
  const { organization } = useOrganization()
  const navigate = useNavigate()
  const refresh = useRefreshRenewals(organization.id)
  const [assignee, setAssignee] = useState(document.owner?.membership_id ?? '')
  const [deadline, setDeadline] = useState(document.expiry_date ?? '')
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const submit = async () => {
    setPending(true)
    setError(null)
    setFieldErrors({})
    try {
      const renewal = await renewalService.create(organization.id, {
        document_id: document.id,
        assignee_membership_id: assignee || null,
        deadline: deadline || null,
        notes: notes.trim() || null,
        request: Boolean(assignee),
      })
      await refresh()
      toast.success(assignee ? 'Renewal requested. The assignee has been told.' : 'Renewal created.')
      onOpenChange(false)
      navigate(paths.org(organization.slug).renewal(renewal.id))
    } catch (caught) {
      if (caught instanceof ApiError && caught.fieldErrors.length > 0) {
        setFieldErrors(Object.fromEntries(caught.fieldErrors.map((item) => [item.field, item.message])))
      } else {
        setError(errorMessage(caught))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a renewal</DialogTitle>
          <DialogDescription>
            Choose who renews {document.name} and by when. They are told by email and in the app.
          </DialogDescription>
        </DialogHeader>
        {error && <Notice variant="error">{error}</Notice>}
        <FormField
          label="Assign to"
          error={fieldErrors.assignee_membership_id}
          hint="Leave empty to create the renewal and assign it later."
        >
          {(field) => (
            <MemberPicker {...field} organizationId={organization.id} value={assignee} onChange={setAssignee} />
          )}
        </FormField>
        <FormField label="Deadline" error={fieldErrors.deadline} hint="Defaults to the current expiry date.">
          {(field) => (
            <Input {...field} type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          )}
        </FormField>
        <FormField label="Notes" hint="Optional. For example, where to apply or who to contact.">
          {(field) => (
            <Textarea {...field} rows={3} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} />
          )}
        </FormField>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button loading={pending} onClick={() => void submit()}>
            {assignee ? 'Request renewal' : 'Create renewal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
