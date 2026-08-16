'use client'

import Link from 'next/link'
import { DemoButton } from '@/components/DemoButton'
import { signInWithGoogle } from '@/lib/supabase/actions'

interface RewardsAuthPromptProps {
  totalCards: number
}

export default function RewardsAuthPrompt({ totalCards }: RewardsAuthPromptProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-2xl flex-col justify-center">
        <section className="rounded-2xl border border-white/20 bg-white/10 p-6 text-center shadow-2xl shadow-purple-950/30 backdrop-blur-sm sm:p-8">
          <div className="mx-auto mb-5 flex h-20 w-16 rotate-[-6deg] flex-col justify-between rounded-xl border border-purple-200/50 bg-white p-2 text-purple-950 shadow-xl shadow-purple-950/30">
            <span className="text-left text-sm font-black leading-none">A</span>
            <span className="text-center text-xl font-black leading-none">+</span>
            <span className="text-right text-sm font-black leading-none">A</span>
          </div>

          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-purple-300">
            Card Collection
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Save every card you unlock
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-purple-100/75">
            Sign in to keep your cards, coins, XP, grades, and pack rewards attached to your account.
            There are {totalCards.toLocaleString()} cards to discover.
          </p>

          <div className="mt-6 grid gap-3">
            <button
              onClick={() => signInWithGoogle('/rewards')}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <DemoButton
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              label="Try as Guest"
              next="/rewards"
            />
          </div>

          <div className="mt-6 flex flex-col gap-2 text-sm sm:flex-row sm:justify-center">
            <Link href="/login?next=/rewards" className="font-semibold text-purple-200 transition hover:text-white">
              Sign in another way
            </Link>
            <span className="hidden text-white/20 sm:inline">/</span>
            <Link href="/how-it-works" className="font-semibold text-purple-200 transition hover:text-white">
              How rewards work
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
