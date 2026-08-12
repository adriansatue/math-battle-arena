'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ReviewItem {
  sequence:       number
  questionText:   string
  answerGiven?:   number | null
  isCorrect:      boolean
  correctAnswer?: number | null
  points:         number
}

type BattleRecord = Record<string, string | number | null>

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: battleId } = use(params)
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [battle,     setBattle]     = useState<BattleRecord | null>(null)
  const [userId,     setUserId]     = useState('')
  const [profiles,   setProfiles]   = useState<Record<string, string>>({})
  const [scores,     setScores]     = useState<Record<string, number>>({})
  const [restarting, setRestarting] = useState(false)
  const [review,     setReview]     = useState<ReviewItem[]>([])
  const [showReview, setShowReview] = useState(false)
  const [waiting,    setWaiting]    = useState(false)

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
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ids)

      if (cancelled) return
      const map: Record<string, string> = {}
      for (const p of (profs ?? [])) map[p.id] = p.username
      setProfiles(map)

      const reviewRes = await fetch(`/api/battles/${battleId}/review`)
      if (cancelled) return
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json().catch(() => ({}))
        setReview((reviewData.review as ReviewItem[]) ?? [])
      }
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (cancelled) return
      setUserId(user.id)

      const { data: b } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single()

      if (!b || cancelled) return
      applyBattle(b as BattleRecord)

      if (b.status === 'finished') {
        setWaiting(false)
        await loadFinishedDetails(b as BattleRecord)
        return
      }

      setWaiting(true)
      let elapsed = 0
      pollInterval = setInterval(async () => {
        elapsed += 500
        const { data: updated } = await supabase
          .from('battles')
          .select('*')
          .eq('id', battleId)
          .single()

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

    load()

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [battleId, router, supabase])

  async function playAgain() {
    setRestarting(true)
    const res = await fetch('/api/battles', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        mode:           battle?.mode ?? 'realtime',
        difficulty:     battle?.difficulty ?? 'medium',
        question_count: 10,
      }),
    }).catch(() => null)

    if (!res) {
      setRestarting(false)
      return
    }

    const data = await res.json().catch(() => ({}))
    if (data.battle) router.push(`/battle/${data.battle.id}`)
    setRestarting(false)
  }

  if (!battle) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse">Loading results...</div>
    </div>
  )

  const winnerId = battle.winner_id ? String(battle.winner_id) : ''
  const isWinner = winnerId === userId
  const isDraw   = !winnerId
  const activeStars = isDraw ? 3 : isWinner ? 5 : 2

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">
          <div className="text-7xl mb-4">
            {isDraw ? 'Draw' : isWinner ? 'Win' : 'GG'}
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {waiting ? 'Finalizing...' : isDraw ? "It's a Draw!" : isWinner ? 'You Won!' : 'Good Fight!'}
          </h1>
          <p className="text-purple-300 mb-8">
            {waiting ? 'Waiting for final scores and review.' : isDraw ? 'Perfectly matched!' : isWinner ? 'Outstanding performance!' : 'Keep practicing!'}
          </p>

          {battle.bet_status === 'settled' && (
            <div className={`rounded-2xl p-4 border text-center mb-4 ${
              isWinner
                ? 'bg-yellow-500/20 border-yellow-500/30'
                : 'bg-red-500/20 border-red-500/30'
            }`}>
              <p className={`font-bold text-lg ${isWinner ? 'text-yellow-300' : 'text-red-300'}`}>
                {isWinner ? 'You won the card bet!' : 'You lost your staked card.'}
              </p>
              <p className="text-white/60 text-sm mt-1">
                {isWinner ? 'The staked card has been added to your collection.' : 'Your opponent claimed it. Win next time.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-8">
            {Object.entries(scores).map(([pid, score]) => (
              <div key={pid} className={`rounded-xl p-4 ${
                pid === userId ? 'bg-purple-600/30 border border-purple-500/50' : 'bg-white/5 border border-white/10'
              }`}>
                <p className="text-purple-300 text-sm mb-1">
                  {pid === userId ? 'You' : profiles[pid] ?? 'Opponent'}
                </p>
                <p className="text-white text-3xl font-bold">{score}</p>
                <p className="text-purple-300 text-xs">points</p>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 mb-8">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={`text-2xl ${i <= activeStars ? 'opacity-100' : 'opacity-20'}`}>*</span>
            ))}
          </div>

          {review.length > 0 && (
            <div className="mb-6 text-left">
              <button
                onClick={() => setShowReview(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition text-sm font-semibold"
              >
                <span>Review my answers ({review.filter(r => r.isCorrect).length}/{review.length} correct)</span>
                <span className="text-xs">{showReview ? 'Hide' : 'Show'}</span>
              </button>
              {showReview && (
                <div className="mt-2 space-y-2">
                  {review.map((r, i) => (
                    <div key={i} className={`rounded-xl px-4 py-3 flex items-start gap-3 border ${
                      r.isCorrect ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
                    }`}>
                      <span className="text-lg shrink-0">{r.isCorrect ? 'OK' : 'X'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">{r.questionText} = ?</p>
                        {r.isCorrect ? (
                          <p className="text-green-300 text-xs mt-0.5">
                            Your answer: <strong>{r.answerGiven}</strong> - +{r.points} pts
                          </p>
                        ) : (
                          <p className="text-red-300 text-xs mt-0.5">
                            You typed: <strong>{r.answerGiven ?? '-'}</strong>
                            {r.correctAnswer != null && <> - Answer: <strong className="text-white">{r.correctAnswer}</strong></>}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/rewards"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
              Cards
            </Link>
            <Link href="/leaderboard"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
              Ranks
            </Link>
            <button
              onClick={playAgain}
              disabled={restarting}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-center">
              {restarting ? 'Creating...' : 'Again'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
