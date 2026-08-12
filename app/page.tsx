import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DemoButton } from '@/components/DemoButton'
import { SwordLogo } from '@/components/SwordLogo'

export const metadata: Metadata = {
  title: 'Math Battle Arena - Free Multiplayer Maths Game for Kids',
  description:
    'Math Battle Arena is a free online maths game where kids challenge friends or AI bots in real-time maths duels. Practice times tables, fractions, addition and more. Perfect for ages 6-14.',
  keywords:
    'maths game kids, free math game, times tables practice, multiplayer maths, math battle, primary school maths, KS1 KS2 maths game',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Math Battle Arena - Free Multiplayer Maths Game for Kids',
    description:
      'Challenge friends or AI bots in fast-paced maths duels. Practice times tables, fractions and more. Free to play, no download needed.',
    type: 'website',
  },
}

const TOPICS = [
  { mark: '+',   title: 'Addition',      desc: 'Single and double-digit adding' },
  { mark: '-',   title: 'Subtraction',   desc: 'Find the difference, fast' },
  { mark: 'x',   title: 'Times Tables',  desc: 'Tables from 1 to 12' },
  { mark: '/',   title: 'Division',      desc: 'Whole-number division drills' },
  { mark: '1/2', title: 'Fractions',     desc: 'Add fractions step by step' },
  { mark: '()',  title: 'Order of Ops',  desc: 'BODMAS and PEMDAS challenges' },
]

const FEATURES = [
  { title: 'Fair Battles', desc: 'Real-time matchmaking now considers rating and level before falling back to AI.' },
  { title: 'Practice With Purpose', desc: 'Train by topic, answer style, difficulty and question count.' },
  { title: 'Cards And Rewards', desc: 'Earn coins, open packs, collect graded cards and get refunds for duplicates.' },
  { title: 'Visible Progress', desc: 'Profiles, rankings and admin stats make progress easier to understand.' },
]

const STEPS = [
  { step: '01', title: 'Pick Your Mode', desc: 'Jump into a quick battle, invite a friend, or practice solo.' },
  { step: '02', title: 'Answer Fast', desc: 'Accuracy matters most, but speed and streaks can swing a close match.' },
  { step: '03', title: 'Level Up', desc: 'Earn XP, coins, rating and collectible cards as you play.' },
]

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = Boolean(user)

  return (
    <div className="min-h-screen bg-[#090b14] text-white">
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:py-14">
        <section className="grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-100">
              Free multiplayer maths battles
            </div>

            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-none tracking-tight sm:text-6xl lg:text-7xl">
              Math Battle Arena
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-white/65 sm:text-xl">
              A fast, competitive maths game where kids train skills, challenge friends, battle AI and collect rewards without downloads or subscriptions.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isLoggedIn ? (
                <>
                  <Link
                    href="/lobby"
                    className="rounded-lg bg-cyan-300 px-6 py-4 text-center text-base font-black text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:bg-cyan-200 hover:-translate-y-0.5"
                  >
                    Play Now
                  </Link>
                  <Link
                    href="/practice"
                    className="rounded-lg border border-white/15 bg-white/[0.06] px-6 py-4 text-center text-base font-bold text-white transition hover:bg-white/[0.1]"
                  >
                    Practice
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-cyan-300 px-6 py-4 text-center text-base font-black text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:bg-cyan-200 hover:-translate-y-0.5"
                  >
                    Play Free
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-lg border border-white/15 bg-white/[0.06] px-6 py-4 text-center text-base font-bold text-white transition hover:bg-white/[0.1]"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {!isLoggedIn && (
              <DemoButton
                className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/65 transition hover:bg-white/[0.08] hover:text-white"
                label="Try as Guest"
              />
            )}

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-2 text-center">
              <HomeMetric value="10" label="Questions per battle" />
              <HomeMetric value="25s" label="Bot fallback" />
              <HomeMetric value="6" label="Practice topics" />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-4 border-b border-white/10 pb-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10">
                <SwordLogo className="h-11 w-11" id="home-panel" />
              </div>
              <div>
                <p className="text-sm font-bold text-cyan-100">Live Game Loop</p>
                <p className="mt-1 text-sm text-white/45">Practice, battle, earn, collect.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {STEPS.map(step => (
                <div key={step.step} className="grid grid-cols-[44px_1fr] gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-xs font-black text-white/70">
                    {step.step}
                  </div>
                  <div>
                    <h2 className="text-sm font-black">{step.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-white/50">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <section className="border-y border-white/10 bg-white/[0.03] px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">Practice Topics</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">Built For Repeated Play</h2>
            </div>
            <p className="max-w-md text-sm text-white/50">
              Each topic can become a quick drill or feed into battle readiness.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {TOPICS.map(topic => (
              <div key={topic.title} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 font-mono text-sm font-black text-cyan-100">
                  {topic.mark}
                </div>
                <h3 className="mt-3 font-black">{topic.title}</h3>
                <p className="mt-1 text-sm text-white/45">{topic.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-4">
          {FEATURES.map(feature => (
            <div key={feature.title} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="font-black">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-14 text-center">
        <h2 className="text-3xl font-black tracking-tight">Ready For The Next Match?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
          Jump straight into the lobby and choose the mode that fits the moment.
        </p>
        <Link
          href={isLoggedIn ? '/lobby' : '/signup'}
          className="mt-6 inline-flex rounded-lg bg-cyan-300 px-7 py-4 text-base font-black text-slate-950 transition hover:bg-cyan-200"
        >
          {isLoggedIn ? 'Go To Lobby' : 'Create Free Account'}
        </Link>
      </section>

      <footer className="px-4 pb-8 text-center text-xs text-white/35">
        Copyright {new Date().getFullYear()} Math Battle Arena - sharpen your mind, one battle at a time
      </footer>
    </div>
  )
}

function HomeMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase leading-4 tracking-wide text-white/35">{label}</p>
    </div>
  )
}
