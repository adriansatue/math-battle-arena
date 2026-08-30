'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SwordLogo } from '@/components/SwordLogo'
import { BotCampaignPanel } from '@/components/lobby/BotCampaignPanel'
import { BotPortrait } from '@/components/bots/BotPortrait'
import { BOT_LEVELS } from '@/lib/game/bot'
import type { BotCampaignLevel } from '@/lib/game/bot'

type CampaignProgress = {
  highest_unlocked: number
  highest_defeated: number
  total_wins: number
}

export default function BotCampaignPage() {
  const router = useRouter()
  const [progress, setProgress] = useState<CampaignProgress | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<BotCampaignLevel>(1)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentRival = BOT_LEVELS[Math.max(0, Math.min(BOT_LEVELS.length - 1, (progress?.highest_unlocked ?? 1) - 1))]

  useEffect(() => {
    let cancelled = false

    async function loadCampaign() {
      const response = await fetch('/api/bot-campaign', { cache: 'no-store' }).catch(() => null)
      if (cancelled) return

      if (response?.status === 401) {
        router.replace('/login?next=/bot-campaign')
        return
      }
      if (!response?.ok) {
        setError('Campaign progress is unavailable. Try again in a moment.')
        setLoading(false)
        return
      }

      const data = await response.json() as { progress: CampaignProgress }
      setProgress(data.progress)
      setSelectedLevel(Math.min(BOT_LEVELS.length, Math.max(1, data.progress.highest_unlocked)))
      setLoading(false)
    }

    void loadCampaign()
    return () => { cancelled = true }
  }, [router])

  async function startBattle(level: BotCampaignLevel) {
    if (starting || !progress || level > progress.highest_unlocked) return
    setStarting(true)
    setError(null)

    const response = await fetch('/api/matchmaking/bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'realtime',
        difficulty: 'medium',
        bot_level: level,
      }),
    }).catch(() => null)
    const data = response ? await response.json().catch(() => ({})) : {}

    if (!response?.ok || !data.battle_id) {
      setError(String(data.error ?? 'Could not prepare this rival. Please try again.'))
      setStarting(false)
      return
    }

    router.push(`/battle/${data.battle_id}`)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 px-4 pb-16 pt-4 font-sans text-white sm:px-6 sm:pb-10 sm:pt-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="rounded-2xl border border-purple-300/20 bg-white/10 p-4 shadow-xl shadow-purple-950/25 backdrop-blur-sm sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <SwordLogo className="h-12 w-12 shrink-0 drop-shadow-xl sm:h-16 sm:w-16" id="bot-campaign-hero" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Solo challenge</p>
              <h1 className="mt-0.5 text-2xl font-black sm:text-4xl">Bot Campaign</h1>
              <p className="mt-1 text-sm text-purple-100/65">Every rival teaches a skill. Complete their mission to unlock the next challenge.</p>
            </div>
            <Link
              href="/lobby"
              className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-purple-100/70 transition hover:bg-white/10 hover:text-white sm:block"
            >
              Back to Play
            </Link>
          </div>
        </header>

        {loading ? (
          <section className="mt-3 rounded-2xl border border-purple-300/20 bg-white/10 p-8 text-center shadow-xl shadow-purple-950/20 backdrop-blur-sm">
            <p className="animate-pulse text-sm font-semibold text-purple-100/65">Loading your rivals...</p>
          </section>
        ) : (
          <>
            {progress && currentRival && (
              <section className="mt-3 grid grid-cols-[4.5rem_1fr] items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 shadow-xl shadow-purple-950/20 sm:grid-cols-[6rem_1fr_auto] sm:gap-5 sm:p-4">
                <BotPortrait level={currentRival.level} category={currentRival.category} className="w-full shadow-lg shadow-purple-950/30" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Continue campaign</p>
                  <h2 className="mt-1 truncate text-lg font-black sm:text-2xl">Level {currentRival.level}: {currentRival.name}</h2>
                  <p className="mt-1 line-clamp-2 text-xs text-purple-100/65 sm:text-sm">{currentRival.mission}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void startBattle(currentRival.level)}
                  disabled={starting}
                  className="col-span-2 min-h-12 rounded-xl bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-purple-950/25 transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1"
                >
                  {starting ? 'Preparing rival...' : `Play level ${currentRival.level} now`}
                </button>
              </section>
            )}

            <div className="mt-3">
              <BotCampaignPanel
                progress={progress}
                selectedLevel={selectedLevel}
                starting={starting}
                error={error}
                onSelect={setSelectedLevel}
                onStart={level => void startBattle(level)}
              />
            </div>
          </>
        )}

        <Link
          href="/lobby"
          className="mt-3 flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-purple-100/75 transition hover:bg-white/20 hover:text-white sm:hidden"
        >
          Back to Play
        </Link>
      </div>
    </main>
  )
}