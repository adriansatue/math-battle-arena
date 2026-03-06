'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NavBar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [userId,  setUserId]  = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      setIsAdmin(data?.is_admin ?? false)
    }
    load()
  }, [supabase])

  // Hide nav on auth pages and battle screen
  const hidden = ['/login', '/signup', '/battle'].some(p => pathname.startsWith(p))
  if (hidden) return null

  const links = [
    { href: '/lobby',       label: 'Play',        emoji: '⚔️' },
    { href: '/leaderboard', label: 'Ranks',        emoji: '🏆' },
    { href: '/rewards',     label: 'Cards',        emoji: '🃏' },
    { href: '/profile',     label: 'Profile',      emoji: '👤' },
  ]

  if (isAdmin) {
    links.push({ href: '/admin', label: 'Admin', emoji: '⚙️' })
  }

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden sm:flex fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-6 h-14">
          <Link href="/lobby" className="text-white font-bold text-lg flex items-center gap-2">
            ⚔️ <span className="hidden md:block">Math Battle Arena</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map(link => {
              const isActive = pathname.startsWith(link.href)
              return (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}>
                  <span>{link.emoji}</span>
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950/90 backdrop-blur-md border-t border-white/10">
        <div className="flex items-center justify-around px-2 h-16">
          {links.map(link => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link key={link.href} href={link.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${
                  isActive ? 'text-white' : 'text-white/40'
                }`}>
                <span className="text-xl">{link.emoji}</span>
                <span className="text-xs font-semibold">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Spacer for desktop top nav */}
      <div className="hidden sm:block h-14" />
    </>
  )
}