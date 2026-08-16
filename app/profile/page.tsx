'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signInWithGoogle } from '@/lib/supabase/actions'

export default function ProfileRedirect() {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push(`/profile/${user.id}`)
      else setLoading(false)
    })
  }, [router, supabase])

  if (!loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 px-4 py-12 text-white">
        <main className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-400/15 text-2xl font-black shadow-xl shadow-purple-950/30">
            P
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-purple-300">Player profile</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Keep your progress</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-purple-100/65">
            Sign in to view your level, battle record, performance insights, and account settings.
          </p>

          <div className="mt-7 w-full rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => signInWithGoogle('/profile')}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-purple-50"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3 text-xs text-white/30">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link href="/login?next=/profile" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold transition hover:bg-white/10">
                Log in
              </Link>
              <Link href="/signup" className="rounded-xl bg-purple-300 px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-purple-200">
                Create account
              </Link>
            </div>
          </div>

          <Link href="/leaderboard" className="mt-5 text-sm font-semibold text-purple-200/60 transition hover:text-white">
            Browse rankings without an account
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse">Loading...</div>
    </div>
  )
}