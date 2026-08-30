'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recordClientEvent } from '@/lib/events/client'
import { getLevelProgress } from '@/lib/game/progression'
import { getResultRecommendation } from '@/lib/game/results'
import { getBotLevelConfig, isBotCampaignLevel } from '@/lib/game/bot'

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

interface CampaignResult {
  won: boolean
  bot_level: number
  first_clear: boolean
  bonus_coins: number
  highest_unlocked: number
  highest_defeated: number
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
  const [campaignResult, setCampaignResult] = useState<CampaignResult | null>(null)

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
      const campaignRequest = isBotCampaignLevel(finishedBattle.bot_level)
        ? fetch(`/api/bot-campaign?battle_id=${battleId}`)
        : Promise.resolve(null)
      const [{ data: loadedProfiles }, reviewResponse, campaignResponse] = await Promise.all([
        supabase.from('profiles').select('id, username').in('id', ids),
        fetch(`/api/battles/${battleId}/review`),
        campaignRequest,
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

      if (campaignResponse?.ok) {
        const campaignData = await campaignResponse.json().catch(() => ({}))
        if (!cancelled) setCampaignResult((campaignData.progress as CampaignResult | null) ?? null)
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
  const outcome = isPractice ? 'Practice complete' : isDraw ? 'Draw' : isWinner ? 'Victory' : 'Defeat'
  const campaignLevel = isBotCampaignLevel(battle.bot_level) ? battle.bot_level : null
  const campaignBot = campaignLevel ? getBotLevelConfig(campaignLevel) : null
  const scoreEntries = Object.entries(scores)
  const userScore = scores[userId] ?? 0
  const opponentScore = scores[opponentId] ?? 0
  const scoreDifference = Math.abs(userScore - opponentScore)
  const correctAnswers = review.filter(item => item.isCorrect).length
  const accuracy = review.length > 0 ? Math.round((correctAnswers / review.length) * 100) : 0

  function trackPracticeRecommendation() {
    if (!recommendation?.topic) return
    void recordClientEvent('recommended_practice_clicked', `battle:${battleId}:recommended-practice`, {
      topic: recommendation.topic,
      source: 'results',
    }, battleId)
  }

  return (
    <main className="min-h-screen bg-[#080a0f] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="relative overflow-hidden border border-white/10 bg-[#11141b] px-5 pb-7 pt-5 sm:px-10 sm:pb-10 sm:pt-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-300 to-cyan-300" />
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-black uppercase text-amber-300/80">Battle report</p>
            <p className="border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-bold uppercase text-white/45">
              {campaignBot ? `Bot Arena · Level ${campaignBot.level}` : String(battle.mode ?? 'Battle')}
            </p>
          </div>

          <div className="mt-7 text-center sm:mt-9">
            <p className={`text-xs font-black uppercase ${isWinner ? 'text-emerald-300' : isDraw ? 'text-cyan-300' : 'text-white/45'}`}>
              {waiting ? 'Calculating final score' : isWinner ? `Won by ${scoreDifference.toLocaleString()} points` : isDraw ? 'Scores level' : isPractice ? 'Session saved' : `${scoreDifference.toLocaleString()} point difference`}
            </p>
            <h1 className="mt-2 text-4xl font-black sm:text-6xl">{waiting ? 'Finalizing...' : outcome}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/55">
            {isPractice
              ? 'Your focused session has been saved.'
              : isDraw
                ? `You and ${profiles[opponentId] ?? 'your opponent'} were evenly matched.`
                : isWinner
                  ? `You outscored ${profiles[opponentId] ?? 'your opponent'}.`
                  : `${profiles[opponentId] ?? 'Your opponent'} took this one. Your progress still counts.`}
            </p>
          </div>

          <section className={`relative mx-auto mt-7 grid max-w-3xl items-center sm:mt-9 ${isPractice ? 'grid-cols-1' : 'grid-cols-[1fr_auto_1fr]'}`} aria-label="Final score">
            {scoreEntries.map(([playerId, score], index) => (
              <div
                key={playerId}
                className={`${isPractice ? 'col-start-1 row-start-1' : index === 1 ? 'col-start-3' : 'col-start-1 row-start-1'} min-w-0 text-center`}
              >
                <p className={`truncate text-xs font-black uppercase ${playerId === userId ? 'text-amber-300' : 'text-white/45'}`}>
                  {playerId === userId ? 'You' : profiles[playerId] ?? 'Opponent'}
                </p>
                <p className="mt-1 text-4xl font-black tabular-nums text-white sm:text-6xl">{score.toLocaleString()}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase text-white/30">Battle points</p>
              </div>
            ))}
            {!isPractice && (
              <div className="col-start-2 row-start-1 mx-3 flex h-11 w-11 items-center justify-center border border-white/10 bg-[#080a0f] text-xs font-black text-white/35 sm:mx-8 sm:h-14 sm:w-14">
                VS
              </div>
            )}
          </section>
        </header>

        {review.length > 0 && (
          <section className="grid grid-cols-3 border-x border-b border-white/10 bg-[#0d1016]" aria-label="Performance summary">
            <div className="border-r border-white/10 px-3 py-4 text-center sm:py-5">
              <p className="text-xl font-black tabular-nums text-white sm:text-2xl">{correctAnswers}/{review.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase text-white/35 sm:text-xs">Correct</p>
            </div>
            <div className="border-r border-white/10 px-3 py-4 text-center sm:py-5">
              <p className={`text-xl font-black tabular-nums sm:text-2xl ${accuracy >= 80 ? 'text-emerald-300' : accuracy >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>{accuracy}%</p>
              <p className="mt-1 text-[10px] font-bold uppercase text-white/35 sm:text-xs">Accuracy</p>
            </div>
            <div className="px-3 py-4 text-center sm:py-5">
              <p className="text-xl font-black tabular-nums text-white sm:text-2xl">{scoreDifference.toLocaleString()}</p>
              <p className="mt-1 text-[10px] font-bold uppercase text-white/35 sm:text-xs">Point gap</p>
            </div>
          </section>
        )}

        <section className="mt-5 border border-white/10 bg-[#11141b] p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-emerald-300/70">Rewards earned</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">Your progress</h2>
            </div>
            {reward && reward.level_after !== reward.level_before && (
              <span className="border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200">
                Level up to {reward.level_after}
              </span>
            )}
          </div>

          {reward ? (
            <>
              <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="border border-emerald-300/15 bg-emerald-300/[0.06] p-3 text-center sm:p-4">
                  <p className="text-xl font-black tabular-nums text-emerald-300 sm:text-2xl">+{reward.xp_earned}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-white/40 sm:text-xs">XP</p>
                </div>
                <div className="border border-amber-300/15 bg-amber-300/[0.06] p-3 text-center sm:p-4">
                  <p className="text-xl font-black tabular-nums text-amber-300 sm:text-2xl">+{reward.coins_earned}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-white/40 sm:text-xs">Coins</p>
                </div>
                <div className="border border-cyan-300/15 bg-cyan-300/[0.06] p-3 text-center sm:p-4">
                  <p className={`text-xl font-black tabular-nums sm:text-2xl ${reward.rating_delta >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                    {signedNumber(reward.rating_delta)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-white/40 sm:text-xs">PvP Rating</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs font-semibold text-white/55">
                  <span>Level {progressAfter.level}</span>
                  <span>{progressAfter.isMaxLevel ? 'Maximum level' : `${progressAfter.xpToNextLevel.toLocaleString()} XP to next level`}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden bg-white/10" role="progressbar" aria-valuenow={progressAfter.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`Level ${progressAfter.level} progress`}>
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-[width] duration-700" style={{ width: `${progressAfter.progressPercent}%` }} />
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

        {campaignBot && campaignResult && (
          <section className="relative mt-5 overflow-hidden border border-amber-300/25 bg-[#18150f] p-5 sm:p-6">
            <div className="absolute inset-y-0 left-0 w-1 bg-amber-300" />
            <div className="sm:flex sm:items-center sm:justify-between sm:gap-8">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-amber-300/75">Bot Arena · Level {campaignBot.level}</p>
                <div className="mt-2">
                <div>
                  <h2 className="text-2xl font-black">
                    {campaignResult.won ? `${campaignBot.name} defeated` : `${campaignBot.name} holds the line`}
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    {campaignResult.won
                      ? campaignResult.first_clear
                        ? campaignBot.level === 20
                          ? `Bot Arena complete. You earned ${campaignResult.bonus_coins} bonus coins.`
                          : `Level ${campaignResult.highest_unlocked} is now unlocked. You earned ${campaignResult.bonus_coins} bonus coins.`
                        : `Campaign progress: ${campaignResult.highest_defeated}/20. Replays still award regular battle XP.`
                      : 'Your regular battle XP still counts. Review your answers and challenge this rival again.'}
                  </p>
                  <div className="mt-3 h-1.5 w-full max-w-sm overflow-hidden bg-white/10">
                    <div
                      className="h-full bg-amber-300 transition-[width] duration-700"
                      style={{ width: `${Math.round((campaignResult.highest_defeated / 20) * 100)}%` }}
                    />
                  </div>
                </div>
                </div>
              </div>
              <Link
                href="/lobby#bot-campaign"
                className="mt-5 block min-h-12 shrink-0 bg-amber-300 px-6 py-3.5 text-center text-sm font-black text-black transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-100 sm:mt-0"
              >
                {campaignResult.won && campaignBot.level < 20 ? 'Next bot level' : 'Challenge again'}
              </Link>
            </div>
          </section>
        )}

        {recommendation && topicLabel && (
          <section className="mt-5 border border-white/10 bg-[#11141b] p-5 sm:p-6">
            <p className="text-xs font-black uppercase text-cyan-300/65">Recommended next</p>
            <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-black sm:text-2xl">
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
                  className="min-h-12 shrink-0 bg-amber-300 px-6 py-3.5 text-center text-sm font-black text-black transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  Practise {topicLabel}
                </Link>
              ) : (
                <Link
                  href="/lobby"
                  className="min-h-12 shrink-0 bg-emerald-400 px-6 py-3.5 text-center text-sm font-black text-black transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  Find another match
                </Link>
              )}
            </div>
          </section>
        )}

        {review.length > 0 && (
          <section className="mt-5 border border-white/10 bg-[#11141b] p-5 sm:p-6">
            <button
              onClick={toggleReview}
              className="flex w-full items-center justify-between gap-4 text-left focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-expanded={showReview}
            >
              <span>
                <span className="block text-xs font-black uppercase text-white/35">Question breakdown</span>
                <strong className="mt-1 block text-xl">Answer review</strong>
                <span className="mt-1 block text-sm text-white/45">{correctAnswers}/{review.length} correct · {accuracy}% accuracy</span>
              </span>
              <span className="border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase text-white/65">
                {showReview ? 'Close' : 'Review'}
              </span>
            </button>

            {showReview && (
              <ol className="mt-5 space-y-2 border-t border-white/10 pt-5">
                {review.map(item => (
                  <li key={item.sequence} className={`grid grid-cols-[2.25rem_1fr] gap-3 border p-3 sm:p-4 ${item.isCorrect ? 'border-emerald-300/15 bg-emerald-300/[0.04]' : 'border-rose-300/15 bg-rose-300/[0.04]'}`}>
                    <span className={`flex h-8 w-8 items-center justify-center text-xs font-black ${item.isCorrect ? 'bg-emerald-400 text-black' : 'bg-rose-400 text-black'}`}>
                      {item.sequence}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold">{item.questionText} = ?</p>
                        <p className={`text-[10px] font-black uppercase ${item.isCorrect ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {item.isCorrect ? 'Correct' : 'Missed'} · {TOPIC_LABELS[item.category] ?? item.category}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-white/55">
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

        <nav className="mt-5 grid grid-cols-2 gap-2 pb-4 sm:grid-cols-[1fr_auto_auto_auto]" aria-label="Battle report actions">
          <Link href="/lobby" className="col-span-2 min-h-12 bg-white px-5 py-3.5 text-center text-sm font-black text-black transition hover:bg-white/85 sm:col-span-1">Play again</Link>
          <Link href="/rewards" className="border border-white/10 bg-white/5 px-5 py-3.5 text-center text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white">Cards</Link>
          <Link href={`/profile/${userId}`} className="border border-white/10 bg-white/5 px-5 py-3.5 text-center text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white">Profile</Link>
          <Link href="/leaderboard" className="col-span-2 border border-white/10 bg-white/5 px-5 py-3.5 text-center text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white sm:col-span-1">Rankings</Link>
        </nav>
      </div>
    </main>
  )
}