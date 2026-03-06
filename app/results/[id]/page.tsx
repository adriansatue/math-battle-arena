'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: battleId } = use(params)
  const router   = useRouter()
  const supabase = createClient()
  const [battle,     setBattle]     = useState<Record<string, unknown> | null>(null)
  const [userId,     setUserId]     = useState('')
  const [profiles,   setProfiles]   = useState<Record<string, string>>({})
  const [scores,     setScores]     = useState<Record<string, number>>({})
  const [restarting, setRestarting] = useState(false)

  async function playAgain() {
    setRestarting(true)

    // Create a fresh battle with same settings
    const res = await fetch('/api/battles', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        mode:           battle?.mode ?? 'realtime',
        difficulty:     battle?.difficulty ?? 'medium',
        question_count: 10,
      }),
    })
    const data = await res.json()
    if (data.battle) {
      router.push(`/battle/${data.battle.id}`)
    }
    setRestarting(false)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: b } = await supabase.from('battles').select('*').eq('id', battleId).single()
      if (!b) return
      setBattle(b)
      setScores({ [b.host_id]: b.host_score, [b.guest_id]: b.guest_score })

      const ids = [b.host_id, b.guest_id].filter(Boolean)
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids)
      const map: Record<string, string> = {}
      for (const p of (profs ?? [])) map[p.id] = p.username
      setProfiles(map)
    }
    load()
  }, [battleId, router, supabase])

  if (!battle) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse">Loading results...</div>
    </div>
  )

  const winnerId = battle.winner_id as string
  const isWinner = winnerId === userId
  const isDraw   = !winnerId

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">

          {/* Result emoji */}
          <div className="text-7xl mb-4">
            {isDraw ? '🤝' : isWinner ? '🏆' : '💪'}
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {isDraw ? "It's a Draw!" : isWinner ? 'You Won!' : 'Good Fight!'}
          </h1>
          <p className="text-purple-300 mb-8">
            {isDraw ? 'Perfectly matched!' : isWinner ? 'Outstanding performance!' : 'Keep practicing!'}
          </p>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {Object.entries(scores).map(([pid, score]) => (
              <div key={pid} className={`rounded-xl p-4 ${
                pid === userId ? 'bg-purple-600/30 border border-purple-500/50' : 'bg-white/5 border border-white/10'
              }`}>
                <p className="text-purple-300 text-sm mb-1">
                  {pid === userId ? '⚔️ You' : `🛡️ ${profiles[pid] ?? 'Opponent'}`}
                </p>
                <p className="text-white text-3xl font-bold">{score}</p>
                <p className="text-purple-300 text-xs">points</p>
              </div>
            ))}
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-2 mb-8">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={`text-2xl ${
                isDraw ? i <= 3 : isWinner ? i <= 5 : i <= 2
                  ? 'opacity-100' : 'opacity-20'
              }`}>⭐</span>
            ))}
          </div>

          <div className="flex gap-3">
            <Link href="/rewards"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
              🃏 Cards
            </Link>
            <Link href="/leaderboard"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
              🏆 Ranks
            </Link>
            <button
              onClick={playAgain}
              disabled={restarting}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-center">
              {restarting ? 'Creating...' : '⚔️ Again'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}