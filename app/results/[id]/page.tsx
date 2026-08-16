'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recordClientEvent } from '@/lib/events/client'
import { getLevelProgress } from '@/lib/game/progression'
import { getResultRecommendation } from '@/lib/game/results'

interface ReviewItem {
  sequence: number
  questionText: string
  category: string
  answerGiven?: number | null
  isCorrect: boolean
  correctAnswer?: number | null
  points: number
}

interface RewardReceipt {
  xp_earned: number
  coins_earned: number
  rating_delta: number
  xp_before: number
  xp_after: number
  rating_before: number
  rating_after: number
  level_before: number
  level_after: number
}

type BattleRecord = Record<string, string | number | null>

const TOPIC_LABELS: Record<string, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  fractions: 'Fractions',
  order_of_ops: 'Order of operations',
}

function signedNumber(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: battleId } = use(params)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [battle, setBattle] = useState<BattleRecord | null>(null)
  const [userId, setUserId] = useState('')
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [review, setReview] = useState<ReviewItem[]>([])
  const [reward, setReward] = useState<RewardReceipt | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    let cancelled = false
    let pollInterval: ReturnType<typeof setInterval> | null = null

    function applyBattle(nextBattle: BattleRecord) {
      setBattle(nextBattle)
      const hostId = String(nextBattle.host_id)
      const guestId = nextBattle.guest_id ? String(nextBattle.guest_id) : ''
      setScores({
        [hostId]: Number(nextBattle.host_score ?? 0),
        ...(guestId ? { [guestId]: Number(nextBattle.guest_score ?? 0) } : {}),
      })
    }

    async function loadFinishedDetails(finishedBattle: BattleRecord) {
      const ids = [finishedBattle.host_id, finishedBattle.guest_id].filter(Boolean) as string[]
      const [{ data: loadedProfiles }, reviewResponse] = await Promise.all([
        supabase.from('profiles').select('id, username').in('id', ids),
        fetch(`/api/battles/${battleId}/review`),
      ])

      if (cancelled) return
      const profileMap: Record<string, string> = {}
      for (const profile of loadedProfiles ?? []) profileMap[profile.id] = profile.username
      setProfiles(profileMap)

      if (reviewResponse.ok) {
        const data = await reviewResponse.json().catch(() => ({}))
        if (!cancelled) {
          setReview((data.review as ReviewItem[]) ?? [])
          setReward((data.reward as RewardReceipt | null) ?? null)
        }
      }

      void recordClientEvent('results_viewed', `battle:${battleId}:results`, {
        mode: String(finishedBattle.mode ?? 'unknown'),
        difficulty: String(finishedBattle.difficulty ?? 'unknown'),
        opponent_type: finishedBattle.bot_id ? 'bot' : finishedBattle.guest_id ? 'human' : 'none',
      }, battleId)
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      if (cancelled) return
      setUserId(user.id)

      const { data } = await supabase.from('battles').select('*').eq('id', battleId).single()
      if (!data || cancelled) return
      applyBattle(data as BattleRecord)

      if (data.status === 'finished') {
        await loadFinishedDetails(data as BattleRecord)
        return
      }

      setWaiting(true)
      let elapsed = 0
      pollInterval = setInterval(async () => {
        elapsed += 500
        const { data: updated } = await supabase.from('battles').select('*').eq('id', battleId).single()
        if (cancelled || !updated) return
        applyBattle(updated as BattleRecord)

        if (updated.status === 'finished') {
          setWaiting(false)
          if (pollInterval) clearInterval(pollInterval)
          await loadFinishedDetails(updated as BattleRecord)
        } else if (elapsed >= 30_000) {
          setWaiting(false)
          if (pollInterval) clearInterval(pollInterval)
        }
      }, 500)
    }

    void load()
    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [battleId, router, supabase])

  function toggleReview() {
    setShowReview(current => {
      if (!current) {
        void recordClientEvent('answer_review_opened', `battle:${battleId}:review`, {
          battle_id: battleId,
        }, battleId)
      }
      return !current
    })
  }

  if (!battle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090b10] text-white">
        <p className="animate-pulse text-sm font-semibold text-white/60">Loading results...</p>
      </main>
    )
  }

  const winnerId = battle.winner_id ? String(battle.winner_id) : ''
  const isPractice = !battle.guest_id
  const isWinner = winnerId === userId
  const isDraw = !isPractice && !winnerId
  const recommendation = getResultRecommendation(review)
  const topicLabel = recommendation?.topic ? TOPIC_LABELS[recommendation.topic] ?? recommendation.topic : null
  const needsPractice = recommendation?.kind === 'focus' && recommendation.correct < recommendation.total
  const progressBefore = getLevelProgress(reward?.xp_before ?? 0)
  const progressAfter = getLevelProgress(reward?.xp_after ?? 0)
  const opponentId = String(battle.host_id) === userId ? String(battle.guest_id ?? '') : String(battle.host_id)
  const outcome = isPractice ? 'Practice complete' : isDraw ? 'Draw' : isWinner ? 'Victory' : 'Good battle'

  function trackPracticeRecommendation() {
    if (!recommendation?.topic) return
    void recordClientEvent('recommended_practice_clicked', `battle:${battleId}:recommended-practice`, {
      topic: recommendation.topic,
      source: 'results',
    }, battleId)
  }

  return (
    <main className="min-h-screen bg-[#090b10] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="border-b border-white/10 pb-6 text-center">
          <p className="text-xs font-bold uppercase text-amber-300/80">Battle report</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">{waiting ? 'Finalizing...' : outcome}</h1>
          <p className="mt-2 text-sm text-white/50">
            {isPractice
              ? 'Your focused session has been saved.'
              : isDraw
                ? `You and ${profiles[opponentId] ?? 'your opponent'} were evenly matched.`
                : isWinner
                  ? `You outscored ${profiles[opponentId] ?? 'your opponent'}.`
                  : `${profiles[opponentId] ?? 'Your opponent'} took this one. Your progress still counts.`}
          </p>
        </header>

        <section className="grid grid-cols-2 border-b border-white/10 py-6">
          {Object.entries(scores).map(([playerId, score]) => (
            <div key={playerId} className={`px-4 text-center ${playerId === userId ? 'text-amber-300' : 'text-white/55'}`}>
              <p className="truncate text-sm font-semibold">{playerId === userId ? 'You' : profiles[playerId] ?? 'Opponent'}</p>
              <p className="mt-1 text-4xl font-black text-white">{score.toLocaleString()}</p>
              <p className="text-xs">battle points</p>
            </div>
          ))}
        </section>

        <section className="border-b border-white/10 py-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-white/40">Rewards earned</p>
              <h2 className="mt-1 text-xl font-black">Progress from this session</h2>
            </div>
            {reward && reward.level_after !== reward.level_before && (
              <span className="border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">
                Level up to {reward.level_after}
              </span>
            )}
          </div>

          {reward ? (
            <>
              <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden border border-white/10 bg-white/10">
                <div className="bg-[#10131a] p-4 text-center">
                  <p className="text-2xl font-black text-emerald-300">+{reward.xp_earned}</p>
                  <p className="mt-1 text-xs text-white/45">XP</p>
                </div>
                <div className="bg-[#10131a] p-4 text-center">
                  <p className="text-2xl font-black text-amber-300">+{reward.coins_earned}</p>
                  <p className="mt-1 text-xs text-white/45">Coins</p>
                </div>
                <div className="bg-[#10131a] p-4 text-center">
                  <p className={`text-2xl font-black ${reward.rating_delta >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                    {signedNumber(reward.rating_delta)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">Rating</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs font-semibold text-white/55">
                  <span>Level {progressAfter.level}</span>
                  <span>{progressAfter.isMaxLevel ? 'Maximum level' : `${progressAfter.xpToNextLevel.toLocaleString()} XP to next level`}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden bg-white/10">
                  <div className="h-full bg-emerald-400" style={{ width: `${progressAfter.progressPercent}%` }} />
                </div>
                <p className="mt-2 text-xs text-white/35">
                  {progressBefore.level === progressAfter.level
                    ? `${progressBefore.progressPercent}% to ${progressAfter.progressPercent}% through this level`
                    : `Advanced from Level ${progressBefore.level} to Level ${progressAfter.level}`}
                </p>
              </div>
            </>
          ) : (
            <p className="mt-4 border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100/70">
              Reward details are still being prepared. Your saved score is not affected.
            </p>
          )}
        </section>

        {recommendation && topicLabel && (
          <section className="border-b border-white/10 py-6">
            <p className="text-xs font-bold uppercase text-white/40">What to do next</p>
            <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-black">
                  {needsPractice ? `Sharpen ${topicLabel}` : `${topicLabel} looked strong`}
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-white/55">
                  {needsPractice
                    ? `You answered ${recommendation.correct} of ${recommendation.total} ${topicLabel.toLowerCase()} questions correctly. A short Easy session is the most useful next step.`
                    : 'You answered every measured question correctly. Keep the momentum with another battle or raise the difficulty.'}
                </p>
              </div>
              {needsPractice ? (
                <Link
                  href={`/practice?topic=${recommendation.topic}&difficulty=easy&source=results`}
                  onClick={trackPracticeRecommendation}
                  className="shrink-0 bg-amber-300 px-5 py-3 text-center text-sm font-black text-black transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  Practise {topicLabel}
                </Link>
              ) : (
                <Link
                  href="/lobby"
                  className="shrink-0 bg-emerald-400 px-5 py-3 text-center text-sm font-black text-black transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  Find another match
                </Link>
              )}
            </div>
          </section>
        )}

        {review.length > 0 && (
          <section className="border-b border-white/10 py-6">
            <button
              onClick={toggleReview}
              className="flex w-full items-center justify-between py-2 text-left focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-expanded={showReview}
            >
              <span>
                <strong className="block text-base">Answer review</strong>
                <span className="text-sm text-white/45">{review.filter(item => item.isCorrect).length}/{review.length} correct</span>
              </span>
              <span className="text-sm font-bold text-white/55">{showReview ? 'Hide' : 'Open'}</span>
            </button>

            {showReview && (
              <ol className="mt-4 divide-y divide-white/10 border-y border-white/10">
                {review.map(item => (
                  <li key={item.sequence} className="grid grid-cols-[2rem_1fr] gap-3 py-4">
                    <span className={`flex h-7 w-7 items-center justify-center text-xs font-black ${item.isCorrect ? 'bg-emerald-400 text-black' : 'bg-rose-400 text-black'}`}>
                      {item.sequence}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold">{item.questionText} = ?</p>
                        <p className="text-xs text-white/35">{TOPIC_LABELS[item.category] ?? item.category}</p>
                      </div>
                      <p className={`mt-1 text-sm ${item.isCorrect ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {item.isCorrect
                          ? `Your answer: ${item.answerGiven} (+${item.points} points)`
                          : `Your answer: ${item.answerGiven ?? '-'}; correct answer: ${item.correctAnswer ?? '-'}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-6 text-sm font-semibold text-white/50">
          <Link href="/lobby" className="hover:text-white">Lobby</Link>
          <Link href="/rewards" className="hover:text-white">Cards</Link>
          <Link href={`/profile/${userId}`} className="hover:text-white">Profile</Link>
          <Link href="/leaderboard" className="hover:text-white">Rankings</Link>
        </nav>
      </div>
    </main>
  )
}