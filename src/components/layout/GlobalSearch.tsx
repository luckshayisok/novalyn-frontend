import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'

import { Spinner } from '@/components/shared/states'
import { ENTITY_TYPE_LABELS, FileIcon, StatusBadge } from '@/features/documents/shared'
import { useOrganization } from '@/hooks/useOrganization'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { documentKeys, insightService } from '@/services/documents'

interface Result {
  key: string
  to: string
  render: () => React.ReactNode
}

/** Header search across documents and records. Arrow keys move, Enter opens. */
export function GlobalSearch() {
  const { organization } = useOrganization()
  const org = paths.org(organization.slug)
  const navigate = useNavigate()
  const listId = useId()
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(text.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [text])

  const search = useQuery({
    queryKey: documentKeys.search(organization.id, term),
    queryFn: ({ signal }) => insightService.search(organization.id, term, signal),
    enabled: term.length >= 2,
    staleTime: 10_000,
  })

  const results: Result[] = [
    ...(search.data?.documents ?? []).map((document) => ({
      key: `d-${document.id}`,
      to: org.document(document.id),
      render: () => (
        <>
          <FileIcon version={document.current_version} />
          <span className="min-w-0 flex-1 truncate">{document.name}</span>
          <StatusBadge document={document} />
        </>
      ),
    })),
    ...(search.data?.entities ?? []).map((entity) => {
      const Icon = ENTITY_TYPE_LABELS[entity.type].icon
      return {
        key: `e-${entity.id}`,
        to: org.entity(entity.id),
        render: () => (
          <>
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{entity.name}</span>
            <span className="text-xs text-muted-foreground">{ENTITY_TYPE_LABELS[entity.type].singular}</span>
          </>
        ),
      }
    }),
  ]

  const go = (to: string) => {
    setOpen(false)
    setText('')
    setTerm('')
    navigate(to)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      const chosen = results[active]
      if (chosen) go(chosen.to)
      else if (term.length >= 2) go(`${org.documents}?q=${encodeURIComponent(term)}`)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showPanel = open && term.length >= 2

  return (
    <PopoverPrimitive.Root open={showPanel} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-label="Search documents and records"
            placeholder="Search documents and records"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setActive(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="h-9 w-full rounded-md border border-input bg-muted/50 pl-9 pr-3 text-sm placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-80 overflow-hidden rounded-md border bg-popover p-1 shadow-md"
        >
          {search.isPending ? (
            <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-muted-foreground">
              <Spinner />
              Searching
            </div>
          ) : search.isError ? (
            <p className="px-3 py-3 text-[13px] text-destructive">Search is not available right now.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-muted-foreground">Nothing matches "{term}".</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results">
              {results.map((result, index) => (
                <li
                  key={result.key}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(result.to)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm',
                    index === active && 'bg-accent',
                  )}
                >
                  {result.render()}
                </li>
              ))}
            </ul>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
