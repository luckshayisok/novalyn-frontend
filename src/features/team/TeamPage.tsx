import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, MailPlus, MoreHorizontal, RotateCw, Trash2, UserMinus, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog, PageHeader, RoleBadge, UserAvatar } from '@/components/shared/misc'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Badge, Skeleton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth, useCurrentUser } from '@/features/auth/AuthProvider'
import { VerifyEmailBanner } from '@/features/auth/VerifyEmail'
import { useOrganization } from '@/hooks/useOrganization'
import { errorMessage } from '@/lib/http'
import { assignableRoles, canManageMember, ROLE_LABELS } from '@/lib/permissions'
import { formatDate, formatRelative } from '@/lib/utils'
import { paths } from '@/routes/paths'
import {
  invitationService,
  memberService,
  organizationService,
  queryKeys,
} from '@/services/organizations'
import type { Invitation, Member, Role } from '@/types/api'

import { InviteForm } from './InviteForm'

type PendingAction =
  | { kind: 'remove'; member: Member }
  | { kind: 'leave' }
  | { kind: 'make-owner'; member: Member }
  | { kind: 'revoke'; invitation: Invitation }

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function TeamPage() {
  const { organization, can } = useOrganization()
  const user = useCurrentUser()
  const { reload } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const canInvite = can('members:invite')
  const canManage = can('members:manage')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const members = useQuery({
    queryKey: queryKeys.members(organization.id),
    queryFn: () => memberService.list(organization.id),
  })
  const invitations = useQuery({
    queryKey: queryKeys.invitations(organization.id),
    queryFn: () => invitationService.list(organization.id),
    enabled: canInvite,
  })

  const refresh = (...keys: Array<readonly unknown[]>) =>
    Promise.all(
      [...keys, queryKeys.auditLogs(organization.id)].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    )

  const changeRole = useMutation({
    mutationFn: ({ member, role }: { member: Member; role: Role }) =>
      memberService.changeRole(organization.id, member.id, role),
    onSuccess: async (updated) => {
      await refresh(queryKeys.members(organization.id))
      toast.success(`${updated.user.full_name} is now ${ROLE_LABELS[updated.role]}.`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const resend = useMutation({
    mutationFn: (invitation: Invitation) => invitationService.resend(organization.id, invitation.id),
    onSuccess: async (invitation) => {
      await refresh(queryKeys.invitations(organization.id))
      toast.success(`A new invitation was sent to ${invitation.email}.`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const confirmPending = async () => {
    if (!pending) return
    switch (pending.kind) {
      case 'remove':
        await memberService.remove(organization.id, pending.member.id)
        await refresh(queryKeys.members(organization.id))
        toast.success(`${pending.member.user.full_name} was removed.`)
        break
      case 'make-owner':
        await memberService.changeRole(organization.id, pending.member.id, 'owner')
        await refresh(queryKeys.members(organization.id))
        toast.success(`${pending.member.user.full_name} is now Owner.`)
        break
      case 'revoke':
        await invitationService.revoke(organization.id, pending.invitation.id)
        await refresh(queryKeys.invitations(organization.id))
        toast.success(`The invitation for ${pending.invitation.email} was revoked.`)
        break
      case 'leave':
        await organizationService.leave(organization.id)
        await reload()
        toast.success(`You left ${organization.name}.`)
        navigate(paths.home, { replace: true })
        break
    }
  }

  const onRoleSelected = (member: Member, role: Role) => {
    if (role === member.role) return
    if (role === 'owner') {
      setPending({ kind: 'make-owner', member })
      return
    }
    changeRole.mutate({ member, role })
  }

  const openInvitations = invitations.data ?? []

  return (
    <>
      <PageHeader
        title="Team"
        description="The people who can access this organization, and what each of them can do."
        actions={
          canInvite && (
            <Button onClick={() => setInviteOpen(true)} disabled={!user.is_email_verified}>
              <MailPlus aria-hidden />
              Invite people
            </Button>
          )
        }
      />

      {canInvite && <VerifyEmailBanner className="mb-6" />}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.data ? `${members.data.length} ${members.data.length === 1 ? 'person' : 'people'}` : ' '}
          </CardDescription>
        </CardHeader>
        {members.isPending ? (
          <TableSkeleton rows={3} columns={4} />
        ) : members.isError ? (
          <ErrorState error={members.error} onRetry={() => void members.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12 pr-5">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.data.map((member) => {
                const manageable = canManage && !member.is_self && canManageMember(organization.role, member.role)
                const roles = assignableRoles(organization.role)
                return (
                  <TableRow key={member.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={member.user.full_name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {member.user.full_name}
                            {member.is_self && <span className="font-normal text-muted-foreground"> (you)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {manageable ? (
                        <Select
                          value={member.role}
                          onValueChange={(role) => onRoleSelected(member, role as Role)}
                          disabled={changeRole.isPending}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-48"
                            aria-label={`Role of ${member.user.full_name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(member.joined_at)}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {(manageable || member.is_self) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${member.user.full_name}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.is_self ? (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setPending({ kind: 'leave' })}
                              >
                                <LogOut aria-hidden />
                                Leave organization
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setPending({ kind: 'remove', member })}
                              >
                                <UserMinus aria-hidden />
                                Remove from organization
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {canInvite && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Invitations that have not been accepted yet.</CardDescription>
          </CardHeader>
          {invitations.isPending ? (
            <TableSkeleton rows={2} columns={4} />
          ) : invitations.isError ? (
            <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} />
          ) : openInvitations.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No open invitations"
              description="Invite a colleague and they will appear here until they accept."
              action={
                <Button variant="outline" onClick={() => setInviteOpen(true)} disabled={!user.is_email_verified}>
                  <MailPlus aria-hidden />
                  Invite people
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="w-12 pr-5">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="pl-5 font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={invitation.role} />
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'expired' ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatRelative(invitation.last_sent_at)}
                      {invitation.status === 'pending' && (
                        <span className="block text-xs">Expires {formatDate(invitation.expires_at)}</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${invitation.email}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={resend.isPending} onSelect={() => resend.mutate(invitation)}>
                            <RotateCw aria-hidden />
                            Resend invitation
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setPending({ kind: 'revoke', invitation })}
                          >
                            <Trash2 aria-hidden />
                            Revoke invitation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite people</DialogTitle>
            <DialogDescription>
              They receive an email with a link to join {organization.name}. The link lasts seven days.
            </DialogDescription>
          </DialogHeader>
          <InviteForm
            organization={organization}
            onInvited={(invitation) => {
              setInviteOpen(false)
              toast.success(`Invitation sent to ${invitation.email}.`)
            }}
            secondaryAction={
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            }
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        onConfirm={confirmPending}
        destructive={pending?.kind !== 'make-owner'}
        {...confirmCopy(pending, organization.name)}
      />
    </>
  )
}

function confirmCopy(
  pending: PendingAction | null,
  organizationName: string,
): { title: string; description: string; confirmLabel: string } {
  switch (pending?.kind) {
    case 'remove':
      return {
        title: `Remove ${pending.member.user.full_name}?`,
        description: `They lose access to ${organizationName} immediately. You can invite them again later.`,
        confirmLabel: 'Remove',
      }
    case 'make-owner':
      return {
        title: `Make ${pending.member.user.full_name} an owner?`,
        description:
          'Owners have full control: they can manage billing, change any role, including yours, and delete the organization.',
        confirmLabel: 'Make owner',
      }
    case 'revoke':
      return {
        title: 'Revoke this invitation?',
        description: `The link sent to ${pending.invitation.email} stops working.`,
        confirmLabel: 'Revoke',
      }
    case 'leave':
      return {
        title: `Leave ${organizationName}?`,
        description: 'You lose access immediately. To come back, someone has to invite you again.',
        confirmLabel: 'Leave',
      }
    default:
      return { title: '', description: '', confirmLabel: 'Confirm' }
  }
}
