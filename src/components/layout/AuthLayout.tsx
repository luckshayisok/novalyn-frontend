import { CalendarClock, FileCheck2, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Logo } from '@/components/shared/Logo'
import { paths } from '@/routes/paths'

const POINTS = [
  {
    icon: FileCheck2,
    title: 'One place for every document',
    text: 'Licenses, insurance, certificates and permits, organized by the people, suppliers and equipment they belong to.',
  },
  {
    icon: CalendarClock,
    title: 'Deadlines you can see coming',
    text: 'Expiry dates tracked for you, with reminders well before a renewal is due.',
  },
  {
    icon: ShieldCheck,
    title: 'A record you can stand behind',
    text: 'Every change is logged, and each team works only with what it is allowed to see.',
  },
]

interface AuthLayoutProps {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Two-panel layout for sign-in, registration and the other signed-out screens. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-sidebar px-12 py-10 text-sidebar-foreground lg:flex">
        <Link to={paths.home} className="w-fit rounded-md" aria-label="NOVALYN home">
          <Logo tone="light" />
        </Link>
        <div className="max-w-md">
          <p className="text-[28px] font-semibold leading-9 tracking-tight text-white">
            Every document. Every deadline. Under control.
          </p>
          <ul className="mt-10 flex flex-col gap-6">
            {POINTS.map(({ icon: Icon, title: pointTitle, text }) => (
              <li key={pointTitle} className="flex gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white/8 ring-1 ring-white/10">
                  <Icon className="size-4 text-[#9db2ff]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{pointTitle}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-sidebar-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sidebar-muted">Document intelligence and compliance management.</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <Link to={paths.home} className="mb-8 inline-flex rounded-md lg:hidden" aria-label="NOVALYN home">
            <Logo />
          </Link>
          <h1 className="text-[22px] font-semibold leading-7">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
