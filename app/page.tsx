import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DemoButton } from '@/components/DemoButton'
import { SwordLogo } from '@/components/SwordLogo'

export const metadata: Metadata = {
  title: 'Math Battle Arena — Free Multiplayer Maths Game for Kids',
  description:
    'Math Battle Arena is a free online maths game where kids challenge friends or AI bots in real-time maths duels. Practice times tables, fractions, addition and more. Perfect for ages 6–14.',
  keywords:
    'maths game kids, free math game, times tables practice, multiplayer maths, math battle, primary school maths, KS1 KS2 maths game',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Math Battle Arena — Free Multiplayer Maths Game for Kids',
    description:
      'Challenge friends or AI bots in fast-paced maths duels. Practice times tables, fractions and more. Free to play, no download needed!',
    type: 'website',
  },
}

const TOPICS = [
  { emoji: '➕', title: 'Addition',       desc: 'Single and double-digit adding' },
  { emoji: '➖', title: 'Subtraction',    desc: 'Find the difference, fast' },
  { emoji: '✖️',  title: 'Times Tables',  desc: '1 to 12 — pick your table' },
  { emoji: '➗', title: 'Division',       desc: 'Whole-number division drills' },
  { emoji: '½',  title: 'Fractions',      desc: 'Adding fractions, step by step' },
  { emoji: '🔢', title: 'Order of Ops',  desc: 'BODMAS / PEMDAS challenges' },
]

const HOW_IT_WORKS = [
  { step: '1', emoji: '🎯', title: 'Choose a topic',  desc: 'Pick your maths category and difficulty — from easy times tables to hard fractions.' },
  { step: '2', emoji: '⚔️', title: 'Battle!',          desc: 'Answer questions faster and more accurately than your opponent — human or AI bot.' },
  { step: '3', emoji: '🏆', title: 'Level up',         desc: 'Earn points, unlock collectible cards, climb the leaderboard and beat your personal best.' },
]

const WHY_KIDS_LOVE = [
  { emoji: '⚡', title: 'Real-time Battles',    desc: 'Race a friend or a classmate live — answer first to grab bonus points.' },
  { emoji: '🤖', title: 'Smart AI Opponents',   desc: "No one online? Our AI bots challenge you at easy, medium or hard level." },
  { emoji: '🃏', title: 'Collectible Cards',    desc: 'Win battles and open card packs to grow your unique collection.' },
  { emoji: '🔥', title: 'Streak Rewards',       desc: 'Answer 3 in a row correctly and earn a streak bonus — keep the fire going!' },
  { emoji: '📊', title: 'Track Your Progress',  desc: 'Your profile shows exactly which topics you are strong in and where to improve.' },
  { emoji: '🌍', title: 'Level Brackets',       desc: 'Compete only against players at your own level — beginners vs beginners, champions vs champions.' },
]

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 flex flex-col">

      {/* ── HERO ─────────────────────────────────────── */}
      <main className="flex flex-col items-center justify-center px-4 pt-12 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-400/30 rounded-full px-4 py-1.5 text-purple-300 text-sm font-semibold mb-8">
          ✨ 100% Free  ·  No downloads  ·  Works on any device
        </div>

        <div className="drop-shadow-2xl animate-bounce mb-6">
          <SwordLogo className="w-24 h-24 sm:w-32 sm:h-32" id="hero" />
        </div>

        <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tight leading-none mb-4">
          Math Battle
          <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Arena
          </span>
        </h1>

        <p className="text-purple-200 text-xl sm:text-2xl max-w-xl mb-4 leading-relaxed font-medium">
          The free maths game where kids challenge friends &amp; AI bots
          in fast-paced real-time duels.
        </p>
        <p className="text-purple-300/80 text-base max-w-lg mb-10">
          Practice times tables, fractions, addition and more — and actually have fun doing it.
          Perfect for ages 6–14.
        </p>

        {isLoggedIn ? (
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
            <Link href="/lobby"
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-purple-900/50 transition-all hover:-translate-y-0.5 hover:shadow-2xl text-center">
              ▶ Play Now
            </Link>
            <Link href="/practice"
              className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-lg py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-center backdrop-blur-sm">
              🎯 Practice
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
              <Link href="/signup"
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-purple-900/50 transition-all hover:-translate-y-0.5 hover:shadow-2xl text-center">
                Play Free 🚀
              </Link>
              <Link href="/login"
                className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-lg py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-center backdrop-blur-sm">
                Sign In
              </Link>
            </div>
            <DemoButton
              className="mt-3 w-full max-w-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-semibold py-3 rounded-2xl text-sm transition"
              label="👀 Try as Guest — no sign-up needed"
            />
          </>
        )}
      </main>

      {/* ── STATS BAR ────────────────────────────────── */}
      <section className="border-y border-white/10 bg-white/5 py-4 px-4">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-purple-200 font-semibold">
          {['🆓 Always free', '📱 Works on phone & tablet', '🧠 Curriculum-aligned', '🔒 Safe for kids', '🌍 Play from anywhere'].map(s => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </section>

      {/* ── WHAT IS MATH BATTLE ARENA ────────────────── */}
      <section className="px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-6">
            What is Math Battle Arena?
          </h2>
          <p className="text-purple-200 text-lg text-center leading-relaxed mb-4">
            Math Battle Arena is a <strong className="text-white">free multiplayer maths game</strong> designed
            to make practising maths genuinely exciting for children aged 6 to 14.
          </p>
          <p className="text-purple-300 text-base text-center leading-relaxed mb-4">
            Instead of boring worksheets, kids answer maths questions in head-to-head battles against
            real players or AI bots — earning points, levelling up, and unlocking collectible cards as they go.
          </p>
          <p className="text-purple-300 text-base text-center leading-relaxed">
            The game covers key curriculum topics including <strong className="text-white">times tables</strong>,
            addition, subtraction, division, fractions and order of operations — all wrapped in a game kids
            actually want to play.
          </p>
        </div>
      </section>

      {/* ── TOPICS ───────────────────────────────────── */}
      <section className="px-4 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            Maths Topics Covered
          </h2>
          <p className="text-purple-300 text-center mb-10">Every topic links directly to primary &amp; secondary school curriculum goals.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {TOPICS.map(t => (
              <div key={t.title} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 transition">
                <div className="text-4xl mb-2">{t.emoji}</div>
                <h3 className="text-white font-bold mb-1">{t.title}</h3>
                <p className="text-purple-300 text-xs leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────── */}
      <section className="bg-white/[0.03] border-y border-white/10 px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(h => (
              <div key={h.step} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-purple-600/40 border border-purple-400/30 text-3xl mb-4">
                  {h.emoji}
                </div>
                <div className="inline-block bg-purple-500/20 text-purple-300 text-xs font-black px-2 py-0.5 rounded-full mb-2 tracking-widest">STEP {h.step}</div>
                <h3 className="text-white font-bold text-lg mb-2">{h.title}</h3>
                <p className="text-purple-300 text-sm leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY KIDS LOVE IT ─────────────────────────── */}
      <section className="px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white text-center mb-3">
            Why Kids Love It
          </h2>
          <p className="text-purple-300 text-center mb-10">More than just maths — it&apos;s a game they&apos;ll come back to.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {WHY_KIDS_LOVE.map(f => (
              <div key={f.title} className="flex gap-4 items-start bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition">
                <div className="text-3xl shrink-0">{f.emoji}</div>
                <div>
                  <h3 className="text-white font-bold mb-1">{f.title}</h3>
                  <p className="text-purple-300 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARENTS & TEACHERS ───────────────────────── */}
      <section className="bg-white/[0.03] border-y border-white/10 px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-5xl mb-6">👨‍👩‍👧</div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            For Parents &amp; Teachers
          </h2>
          <p className="text-purple-200 text-lg leading-relaxed mb-4">
            Math Battle Arena uses the same competitive spirit that makes kids play video games for hours — and
            channels it into maths practice. Every question answered is curriculum-aligned.
          </p>
          <ul className="text-purple-300 text-sm space-y-2 text-left max-w-md mx-auto mb-8 list-none">
            {[
              '✅ Completely free — no subscription required',
              '✅ No in-app purchases or real money spent',
              '✅ Progress tracked per topic on every child\'s profile',
              '✅ Works on phone, tablet and computer',
              '✅ Safe — no personal information shown publicly',
            ].map(item => <li key={item}>{item}</li>)}
          </ul>
          {!isLoggedIn && (
            <Link href="/signup"
              className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-lg px-10 py-4 rounded-2xl shadow-xl transition-all hover:-translate-y-0.5">
              Create a Free Account 🚀
            </Link>
          )}
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────── */}
      <section className="px-4 py-20 text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to Battle?</h2>
        <p className="text-purple-300 mb-8 text-lg">Join thousands of kids sharpening their maths skills every day.</p>
        {isLoggedIn ? (
          <Link href="/lobby"
            className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-xl px-12 py-5 rounded-2xl shadow-xl transition-all hover:-translate-y-0.5">
            ▶ Play Now
          </Link>
        ) : (
          <Link href="/signup"
            className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-xl px-12 py-5 rounded-2xl shadow-xl transition-all hover:-translate-y-0.5">
            Play Free 🚀
          </Link>
        )}
      </section>

      {/* ── FOOTER ───────────────────────────────────── */}
      <footer className="text-center pb-8 text-purple-400/50 text-xs px-4">
        © {new Date().getFullYear()} Math Battle Arena — sharpen your mind, one battle at a time
      </footer>

    </div>
  )
}
