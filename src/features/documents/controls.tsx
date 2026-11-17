/* Form controls shared by the document and entity screens. */

import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, UploadCloud } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ComponentProps, type DragEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { entityKeys, entityService } from '@/services/documents'
import { memberService, queryKeys } from '@/services/organizations'
import type { EntityType } from '@/types/api'

import { ACCEPTED_EXTENSIONS, ACCEPTED_LABEL, ENTITY_TYPE_LABELS, ENTITY_TYPES } from './shared'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground',
        'placeholder:text-muted-foreground/70 transition-[border-color,box-shadow]',
        'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:bg-muted aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  busy?: boolean
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, busy = false, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
      <p className="text-[13px] text-muted-foreground tabular-nums">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || busy} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount || busy}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  )
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
}

/** Text input that reports changes after the user pauses typing. */
export function SearchInput({ value, onChange, placeholder, label, className }: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  }, [onChange])

  useEffect(() => {
    if (draft === value) return
    const timer = window.setTimeout(() => latest.current(draft), 300)
    return () => window.clearTimeout(timer)
  }, [draft, value])

  return (
    <Input
      type="search"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className={className}
    />
  )
}

interface DropZoneProps {
  onFiles: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
  compact?: boolean
}

/** Drag files here or click to choose them. */
export function DropZone({ onFiles, multiple = true, disabled = false, compact = false }: DropZoneProps) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setOver(false)
    if (disabled) return
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 text-center transition-colors',
        'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
        compact ? 'py-6' : 'py-10',
        over ? 'border-brand bg-brand-soft' : 'border-input hover:border-brand/60 hover:bg-accent/60',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <UploadCloud className="size-7 text-muted-foreground" aria-hidden />
      <span className="mt-3 text-sm font-medium">
        {multiple ? 'Drop files here, or click to choose' : 'Drop a file here, or click to choose'}
      </span>
      <span className="mt-1 text-xs text-muted-foreground">{ACCEPTED_LABEL}</span>
      <input
        ref={input}
        id={inputId}
        type="file"
        className="sr-only"
        multiple={multiple}
        disabled={disabled}
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) onFiles(files)
          event.target.value = '' // let the same file be chosen again
        }}
      />
    </label>
  )
}

interface PickerProps extends Omit<ComponentProps<'select'>, 'value' | 'onChange'> {
  organizationId: string
  value: string
  onChange: (value: string) => void
}

/** Choose one of the organization's records, grouped by kind. `types` limits the kinds offered. */
export function EntityPicker({
  organizationId,
  value,
  onChange,
  types,
  emptyLabel = 'None',
  ...props
}: PickerProps & { types?: EntityType[]; emptyLabel?: string }) {
  const lookup = useQuery({
    queryKey: entityKeys.lookup(organizationId),
    queryFn: () => entityService.lookup(organizationId),
  })
  const offered = types ?? ENTITY_TYPES
  const options = (lookup.data ?? []).filter((item) => offered.includes(item.type))

  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)} {...props}>
      <option value="">{lookup.isPending ? 'Loading…' : emptyLabel}</option>
      {offered.map((type) => {
        const group = options.filter((item) => item.type === type)
        if (group.length === 0) return null
        return offered.length === 1 ? (
          group.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))
        ) : (
          <optgroup key={type} label={ENTITY_TYPE_LABELS[type].plural}>
            {group.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </optgroup>
        )
      })}
    </NativeSelect>
  )
}

/** Choose a member of the organization, by membership. */
export function MemberPicker({ organizationId, value, onChange, ...props }: PickerProps) {
  const members = useQuery({
    queryKey: queryKeys.members(organizationId),
    queryFn: () => memberService.list(organizationId),
  })
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)} {...props}>
      <option value="">{members.isPending ? 'Loading…' : 'Nobody assigned'}</option>
      {(members.data ?? []).map((member) => (
        <option key={member.id} value={member.id}>
          {member.user.full_name}
        </option>
      ))}
    </NativeSelect>
  )
}
