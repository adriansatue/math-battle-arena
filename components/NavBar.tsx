'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SwordLogo } from '@/components/SwordLogo'

type NavIconProps = {
  className?: string
}

type NavLink = {
  href: string
  label: string
  Icon: (props: NavIconProps) => React.ReactElement
}

export default function NavBar() {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      setIsAdmin(data?.is_admin ?? false)
    }
    load()
  }, [supabase])

  useEffect(() => {
    let cancelled = false

    async function runCleanup() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      await fetch('/api/battles/cleanup', { method: 'POST' }).catch(() => null)
    }

    runCleanup()
    const interval = window.setInterval(runCleanup, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [supabase])

  const hidden = ['/login', '/signup', '/battle/', '/practice/'].some(p => pathname.startsWith(p))
    || pathname === '/battle'
  if (hidden) return null

  const links: NavLink[] = [
    { href: '/lobby',       label: 'Play',     Icon: PlayIcon },
    { href: '/practice',    label: 'Practice', Icon: PracticeIcon },
    { href: '/leaderboard', label: 'Ranks',    Icon: RanksIcon },
    { href: '/rewards',     label: 'Cards',    Icon: CardsIcon },
    { href: '/profile',     label: 'Profile',  Icon: ProfileIcon },
  ]

  if (isAdmin) {
    links.push({ href: '/admin', label: 'Admin', Icon: AdminIcon })
  }

  return (
    <>
      <nav className="hidden sm:flex fixed top-0 left-0 right-0 z-40 bg-gray-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-6 h-14">
          <Link href="/" className="text-white font-bold text-lg flex items-center gap-2">
            <SwordLogo className="w-7 h-7" id="nav" />
            <span className="hidden md:block">Math Battle Arena</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map(link => {
              const isActive = pathname.startsWith(link.href)
              const Icon = link.Icon

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-400/15 text-white ring-1 ring-cyan-300/25'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 transition-colors ${
                    isActive ? 'text-cyan-200' : 'text-white/45 group-hover:text-white/80'
                  }`} />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur-xl border-t border-white/10">
        <div className="flex items-center justify-around px-1.5 h-16">
          {links.map(link => {
            const isActive = pathname.startsWith(link.href)
            const Icon = link.Icon

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1.5 py-2 transition-all ${
                  isActive ? 'text-white' : 'text-white/45 hover:text-white/75'
                }`}
              >
                <span className={`flex h-7 w-9 items-center justify-center rounded-full transition-all ${
                  isActive
                    ? 'bg-cyan-400/15 ring-1 ring-cyan-300/25'
                    : 'group-hover:bg-white/10'
                }`}>
                  <Icon className={`h-5 w-5 transition-colors ${
                    isActive ? 'text-cyan-200' : 'text-white/45 group-hover:text-white/75'
                  }`} />
                </span>
                <span className="max-w-full truncate text-[11px] font-semibold leading-none">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="hidden sm:block h-14" />
    </>
  )
}

function PlayIcon({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 18.5 18.5 5.5" />
      <path d="m14.5 5.5 4 4" />
      <path d="m4.5 19.5 3.5-1 1-3.5" />
      <path d="M6 5.5 18.5 18" />
      <path d="m15.5 19 3.5-1 1-3.5" />
    </svg>
  )
}

function PracticeIcon({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.75v3" />
      <path d="M12 18.25v3" />
      <path d="M2.75 12h3" />
      <path d="M18.25 12h3" />
      <path d="m14.5 9.5-2.8 3.1-1.4-1.3" />
    </svg>
  )
}

function RanksIcon({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19v-5.5a1 1 0 0 1 1-1h3V19" />
      <path d="M9 19V8.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V19" />
      <path d="M15 19v-7h3a1 1 0 0 1 1 1v6" />
      <path d="M4 19h16" />
      <path d="m12 3 1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2L8.8 5.3 11 5z" />
    </svg>
  )
}

function CardsIcon({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4.5h8.5a2 2 0 0 1 2 2V17" />
      <rect x="5.5" y="7" width="10.5" height="13" rx="2" />
      <path d="M9 11h3.5" />
      <path d="M9 15.5h2" />
      <path d="m14 12.5 1 1 2-2" />
    </svg>
  )
}

function ProfileIcon({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
      <circle cx="12" cy="12" r="9" opacity="0.28" />
    </svg>
  )
}

function AdminIcon({ className }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 19 7v5.5c0 4.2-2.9 6.8-7 8-4.1-1.2-7-3.8-7-8V7z" />
      <path d="M9.5 12.2 11.2 14l3.5-4" />
    </svg>
  )
}
