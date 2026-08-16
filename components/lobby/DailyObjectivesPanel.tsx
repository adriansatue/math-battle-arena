'use client'

import { useEffect, useState } from 'react'
import {
  DAILY_OBJECTIVE_COPY,
  objectivePercent,
  type DailyObjectiveKey,
  type DailyObjectiveSummary,
} from '@/lib/game/daily-objectives'
import { recordClientEvent } from '@/lib/events/client'

type ClaimResponse = {
  claim?: {
    objective_key: DailyObjectiveKey
    reward_coins: number
    points_balance: number
  }
  error?: string
}

export function DailyObjectivesPanel({
  onBalanceChange,
}: {
  onBalanceChange: (balance: number) => void
}) {
  const [summary, setSummary] = useState<DailyObjectiveSummary | null>(null)
  const [claiming, setClaiming] = useState<DailyObjectiveKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadSummary() {
    const response = await fetch('/api/objectives', { cache: 'no-store' })
    if (!response.ok) throw new Error('Could not load objectives')
    const data = await response.json() as DailyObjectiveSummary
    setSummary(data)
  }

  useEffect(() => {
    let active = true
    fetch('/api/objectives', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load objectives')
        const data = await response.json() as DailyObjectiveSummary
        if (active) {
          setSummary(data)
          void recordClientEvent('daily_objectives_viewed')
        }
      })
      .catch(() => {
        if (active) setError('Daily objectives are temporarily unavailable.')
      })
    return () => { active = false }
  }, [])

  async function claimReward(objectiveKey: DailyObjectiveKey) {
    setClaiming(objectiveKey)
    setError(null)
    const response = await fetch('/api/objectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective_key: objectiveKey }),
    })
    const data = await response.json().catch(() => ({})) as ClaimResponse

    if (!response.ok || !data.claim) {
      setError(data.error ?? 'Could not claim this reward.')
      setClaiming(null)
      return
    }

    onBalanceChange(data.claim.points_balance)
    await loadSummary().catch(() => setError('Reward claimed. Progress will refresh shortly.'))
    setClaiming(null)
  }

  if (!summary && !error) {
    return <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]" />
  }

  if (!summary) {
    return (
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
        {error}
      </div>
    )
  }

  const completedCount = summary.objectives.filter(objective => objective.completed).length
  const { streaks } = summary

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300/20 bg-[#15121d]/90 shadow-xl shadow-purple-950/20">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">◎</span>
            <h2 className="text-base font-black">Today&apos;s objectives</h2>
            <span className="text-xs font-bold text-amber-200">{completedCount}/3</span>
          </div>
          <p className="mt-0.5 text-xs text-white/40">Resets daily at 00:00 UTC</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 text-center">
          <div className="bg-[#15121d] px-3 py-2">
            <p className="text-sm font-black text-amber-300">{streaks.current_days} days</p>
            <p className="text-[10px] uppercase text-white/35">Current streak</p>
          </div>
          <div className="bg-[#15121d] px-3 py-2">
            <p className="text-sm font-black text-cyan-300">{streaks.current_weeks} weeks</p>
            <p className="text-[10px] uppercase text-white/35">Weekly streak</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/[0.07]">
        {summary.objectives.map(objective => {
          const copy = DAILY_OBJECTIVE_COPY[objective.key]
          const canClaim = objective.completed && !objective.claimed
          return (
            <div key={objective.key} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{copy.title}</p>
                    <p className="truncate text-xs text-white/40">{copy.description}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-white/55">
                    {objective.progress}/{objective.target}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-white/10">
                  <div
                    className={`h-full ${objective.completed ? 'bg-emerald-400' : 'bg-amber-300'}`}
                    style={{ width: `${objectivePercent(objective)}%` }}
                  />
                </div>
              </div>

              {canClaim ? (
                <button
                  type="button"
                  onClick={() => claimReward(objective.key)}
                  disabled={claiming !== null}
                  className="min-w-20 bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-200 disabled:opacity-50"
                >
                  {claiming === objective.key ? 'Claiming' : `Claim +${objective.reward_coins}`}
                </button>
              ) : (
                <span className={`min-w-20 text-right text-xs font-bold ${objective.claimed ? 'text-emerald-300' : 'text-amber-200/60'}`}>
                  {objective.claimed ? 'Claimed' : `+${objective.reward_coins} coins`}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-white/10 bg-black/15 px-4 py-2 text-[11px] text-white/35">
        <span>Best: {streaks.best_days} consecutive days · {streaks.best_weeks} consecutive weeks</span>
        <span>Active history: {streaks.total_days} days · {streaks.total_weeks} weeks</span>
      </div>
      {error && <p className="border-t border-red-300/15 px-4 py-2 text-xs text-red-200">{error}</p>}
    </section>
  )
}