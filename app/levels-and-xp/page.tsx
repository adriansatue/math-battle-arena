import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Levels and XP',
  description:
    'Learn how levels, XP, coins, rating, and practice difficulty work in Math Battle Arena.',
  alternates: { canonical: '/levels-and-xp' },
}

const XP_TYPES = [
  {
    title: 'XP',
    text: 'XP is lifetime progress. It raises your account level and is never spent.',
  },
  {
    title: 'Coins',
    text: 'Coins are spendable rewards. Use them to open packs and build your card collection.',
  },
  {
    title: 'Rating',
    text: 'Rating measures competitive PvP performance. Practice does not change your rating.',
  },
]

const LEVEL_BANDS = [
  {
    range: 'Levels 1-10',
    title: 'Starter',
    focus: 'Small-number arithmetic',
    text: 'Learn the loop with low-pressure addition, subtraction, times tables, and generous time limits.',
  },
  {
    range: 'Levels 11-20',
    title: 'Builder',
    focus: 'Core fluency',
    text: 'Move beyond the easiest sets with larger numbers, mixed tables, and cleaner answer habits.',
  },
  {
    range: 'Levels 21-30',
    title: 'Challenger',
    focus: 'Speed and accuracy',
    text: 'Start earning the best XP from medium timed sets, mixed operations, and early battle practice.',
  },
  {
    range: 'Levels 31-40',
    title: 'Solver',
    focus: 'Multi-step thinking',
    text: 'Simple warm-ups still work, but meaningful progress should come from order of operations and harder number ranges.',
  },
  {
    range: 'Levels 41-50',
    title: 'Strategist',
    focus: 'Reliable consistency',
    text: 'Players should be rewarded for clean streaks, fewer mistakes, and stronger performance across several topics.',
  },
  {
    range: 'Levels 51-60',
    title: 'Specialist',
    focus: 'Weak-topic mastery',
    text: 'The best XP should come from improving weaker areas rather than repeating already-mastered easy drills.',
  },
  {
    range: 'Levels 61-70',
    title: 'Expert',
    focus: 'Advanced practice',
    text: 'Fractions, harder division, negative numbers, and tighter timers should become the main XP path.',
  },
  {
    range: 'Levels 71-80',
    title: 'Contender',
    focus: 'Competitive readiness',
    text: 'Practice prepares players for tougher bot battles and real PvP, where pressure and rating matter.',
  },
  {
    range: 'Levels 81-90',
    title: 'Elite',
    focus: 'High-difficulty performance',
    text: 'High-level players should need hard content, mixed topics, and strong battle results for full XP.',
  },
  {
    range: 'Levels 91-100',
    title: 'Master',
    focus: 'Endgame mastery',
    text: 'Reaching the top should represent broad maths fluency, not farming easy questions repeatedly.',
  },
]

const XP_RULES = [
  {
    label: 'Full XP',
    text: 'You earn full XP when the content matches your current level and skill range.',
  },
  {
    label: 'Reduced XP',
    text: 'You can still play easier content, but XP may be reduced when it is far below your level.',
  },
  {
    label: 'Warm-up only',
    text: 'Very easy content may become useful for practice and coins, but not for serious XP farming.',
  },
]

const PRACTICE_EXAMPLES = [
  {
    levelRange: '1-10',
    content: 'Addition up to 20',
    bestFor: 'New players and warm-ups',
    highLevelEffect: 'Reduced XP once the player has clearly mastered it',
  },
  {
    levelRange: '11-30',
    content: 'Addition and subtraction up to 100',
    bestFor: 'Core fluency',
    highLevelEffect: 'Reduced XP for advanced players unless used as a warm-up',
  },
  {
    levelRange: '21-40',
    content: 'Times tables and division facts',
    bestFor: 'Speed and recall',
    highLevelEffect: 'Best XP when mixed with tighter timers or harder tables',
  },
  {
    levelRange: '31-60',
    content: 'Mixed operations',
    bestFor: 'Intermediate players',
    highLevelEffect: 'Good XP while the difficulty remains challenging',
  },
  {
    levelRange: '61-100',
    content: 'Fractions and hard timed sets',
    bestFor: 'Advanced players',
    highLevelEffect: 'Strong XP for players ready for higher-level practice',
  },
]

export default function LevelsAndXpPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-4">
          <Link href="/how-it-works" className="text-sm font-semibold text-purple-300 transition hover:text-purple-200">
            Back to guide
          </Link>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-300">Progression Guide</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Levels and XP
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-purple-100/80">
              Math Battle Arena uses levels to show long-term progress. The goal is simple:
              players should always be able to practise, but the best XP should come from content
              that is still challenging for their current level.
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {XP_TYPES.map(item => (
            <article key={item.title} className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
              <h2 className="text-xl font-black text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{item.text}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Level 1-100 Progression</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            The progression is split into 10 clear tiers. Each tier covers 10 account levels and
            describes the type of maths practice that should still feel rewarding at that point.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {LEVEL_BANDS.map(band => (
              <article key={band.range} className="rounded-lg bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">{band.range}</p>
                <h3 className="mt-2 font-black text-white">{band.title}</h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/35">{band.focus}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{band.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Why Easy Practice Gives Less XP Later</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Practice should stay useful at every level, but it should not become an infinite XP farm.
            A high-level player can still warm up with easy addition, but meaningful level progress
            should come from topics that match their ability.
          </p>
          <div className="mt-5 grid gap-3">
            {XP_RULES.map(rule => (
              <div key={rule.label} className="rounded-lg border border-white/10 bg-black/15 p-4">
                <h3 className="font-black text-white">{rule.label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{rule.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Practice Difficulty Examples</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[680px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/45">
                <tr className="border-b border-white/10">
                  <th className="py-3 pr-4">Levels</th>
                  <th className="py-3 pr-4">Content</th>
                  <th className="py-3 pr-4">Best for</th>
                  <th className="py-3 pr-4">At higher levels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-white/70">
                {PRACTICE_EXAMPLES.map(row => (
                  <tr key={row.content}>
                    <td className="py-3 pr-4 font-semibold text-cyan-200">{row.levelRange}</td>
                    <td className="py-3 pr-4 font-semibold text-white">{row.content}</td>
                    <td className="py-3 pr-4">{row.bestFor}</td>
                    <td className="py-3 pr-4">{row.highLevelEffect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-xl font-black text-white">Practice still matters</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Practice is the safest place to build accuracy, fix weak topics, and prepare for
              battles. Even when some easy sets give reduced XP, they can still help players improve.
            </p>
          </article>

          <article className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-xl font-black text-white">Battles stay rewarding</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Battles reward performance under pressure. PvP also uses rating, so players have a
              separate competitive path alongside their account level.
            </p>
          </article>
        </section>

        <div className="flex flex-col gap-3 pb-4 sm:flex-row">
          <Link
            href="/practice"
            className="flex-1 rounded-lg bg-white/10 px-5 py-3 text-center font-bold text-white transition hover:bg-white/15"
          >
            Start Practice
          </Link>
          <Link
            href="/lobby"
            className="flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-3 text-center font-black text-white transition hover:from-purple-400 hover:to-pink-400"
          >
            Play a Battle
          </Link>
        </div>
      </div>
    </main>
  )
}
