import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How the Game Works',
  description:
    'Learn how Math Battle Arena works: practice mode, PvP battles, bot battles, XP, coins, rating, rewards, streaks, and fair play.',
  alternates: { canonical: '/how-it-works' },
}

const MODES = [
  {
    title: 'Practice',
    subtitle: 'Train without pressure',
    description:
      'Practice is for improving specific maths skills. Choose a topic, answer style, difficulty, and number of questions. You earn XP and a smaller amount of coins, but practice does not affect your PvP rating or win/loss record.',
    details: ['Best for learning', 'Earns XP', 'Limited coins', 'No rating changes'],
  },
  {
    title: 'Bot Battles',
    subtitle: 'Play anytime',
    description:
      'Bot battles give you a real match flow even when no human opponent is available. They reward more than practice, but they do not count as competitive PvP rating matches.',
    details: ['Good for warmups', 'Earns XP', 'Medium coins', 'No PvP rating changes'],
  },
  {
    title: 'PvP Battles',
    subtitle: 'The competitive mode',
    description:
      'PvP battles are matches against real players. They give the strongest rewards, update your win/loss record, and change your PvP rating based on the result.',
    details: ['Best rewards', 'Full coins', 'Win/loss record', 'PvP rating changes'],
  },
]

const REWARD_ROWS = [
  { mode: 'Practice', xp: 'Yes', coins: 'Low', rating: 'No', record: 'No' },
  { mode: 'Bot Battle', xp: 'Yes', coins: 'Medium', rating: 'No', record: 'Yes' },
  { mode: 'PvP Battle', xp: 'Yes', coins: 'Full', rating: 'Yes', record: 'Yes' },
]

const STEPS = [
  {
    title: 'Choose how to play',
    text: 'Start from the lobby for battles or from Practice to train a specific topic. Pick the difficulty that matches your current level.',
  },
  {
    title: 'Answer each question',
    text: 'Correct answers earn score. Faster answers can earn a small speed bonus, but accuracy matters most.',
  },
  {
    title: 'Build streaks',
    text: 'Consecutive correct answers unlock streak bonuses. Longer streaks are worth more, but the bonus is capped to keep matches fair.',
  },
  {
    title: 'Finish the session',
    text: 'At the end, your score is converted into progress rewards depending on the mode you played.',
  },
]

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-4">
          <Link href="/lobby" className="text-sm font-semibold text-purple-300 transition hover:text-purple-200">
            Back to game
          </Link>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-300">Player Guide</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
              How Math Battle Arena Works
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-purple-100/80">
              Math Battle Arena is a fast maths game built around practice, battles, progression,
              and collectible rewards. This page explains what each mode does and how the reward
              system is balanced.
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {MODES.map(mode => (
            <article
              key={mode.title}
              className="grid h-full grid-rows-[auto_auto_1fr_auto] rounded-lg border border-white/10 bg-white/[0.06] p-5"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">{mode.subtitle}</p>
              <h2 className="mt-2 text-xl font-black text-white">{mode.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{mode.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                {mode.details.map(detail => (
                  <li key={detail} className="rounded-md bg-white/5 px-3 py-2">
                    {detail}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">The Core Loop</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-sm font-black text-cyan-200">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-bold text-white">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">XP, Coins, and Rating</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <InfoBlock
              title="XP"
              text="XP is your lifetime progress. It raises your level and rank title. XP is never spent."
            />
            <InfoBlock
              title="Coins"
              text="Coins are spendable rewards. Use them to open packs and build your card collection."
            />
            <InfoBlock
              title="Rating"
              text="Rating measures PvP performance. It only changes in real player-versus-player battles."
            />
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Reward Balance</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Each mode matters, but they do not all pay out the same way. Practice helps you improve,
            bot battles keep the game playable anytime, and PvP is the main competitive path.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/45">
                <tr className="border-b border-white/10">
                  <th className="py-3 pr-4">Mode</th>
                  <th className="py-3 pr-4">XP</th>
                  <th className="py-3 pr-4">Coins</th>
                  <th className="py-3 pr-4">Rating</th>
                  <th className="py-3 pr-4">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-white/70">
                {REWARD_ROWS.map(row => (
                  <tr key={row.mode}>
                    <td className="py-3 pr-4 font-semibold text-white">{row.mode}</td>
                    <td className="py-3 pr-4">{row.xp}</td>
                    <td className="py-3 pr-4">{row.coins}</td>
                    <td className="py-3 pr-4">{row.rating}</td>
                    <td className="py-3 pr-4">{row.record}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-xl font-black text-white">Questions and Scoring</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              A correct answer earns base score based on difficulty. Harder questions are worth more.
              Speed can add a small bonus, and streaks reward consistent accuracy. Wrong answers and
              timeouts earn zero for that question.
            </p>
          </article>

          <article className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-xl font-black text-white">Cards and Rewards</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Coins can be spent on reward packs. Cards are collectible game items and do not have
              real-world monetary value. Some battles can also include card stakes when both players
              agree.
            </p>
          </article>
        </section>

        <section className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-6">
          <h2 className="text-xl font-black text-white">Fair Play</h2>
          <p className="mt-3 text-sm leading-relaxed text-emerald-50/80">
            The server validates answers and timings. Very unusual answer times can be flagged for
            review, and flagged answers do not contribute to final profile rewards. This keeps battles
            fair for players who are practising honestly.
          </p>
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

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-4">
      <h3 className="font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
    </div>
  )
}
