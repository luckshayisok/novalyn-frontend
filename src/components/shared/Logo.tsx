import { cn } from '@/lib/utils'

interface LogoProps {
  /** `light` for use on the navy sidebar, `dark` on light surfaces. */
  tone?: 'light' | 'dark'
  className?: string
  showWordmark?: boolean
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('size-7 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#14274e" />
      <path
        d="M9.5 22.5v-13l13 13v-13"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="9.5" r="2.4" fill="#5b7cfa" />
    </svg>
  )
}

export function Logo({ tone = 'dark', className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={tone === 'light' ? 'rounded-[7px] ring-1 ring-white/15' : undefined} />
      {showWordmark && (
        <span
          className={cn(
            'text-[15px] font-semibold tracking-[0.16em]',
            tone === 'light' ? 'text-white' : 'text-primary',
          )}
        >
          NOVALYN
        </span>
      )}
    </span>
  )
}
