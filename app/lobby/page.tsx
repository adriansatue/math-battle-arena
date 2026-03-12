'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Mode       = 'realtime' | 'turnbased'
type Difficulty = 'easy' | 'medium' | 'hard'

export default function LobbyPage() {
  const router = useRouter()

  // Friend panel: null = hidden, 'create' = create battle, 'join' = join by code
  const [friendPanel, setFriendPanel] = useState<null | 'create' | 'join'>(null)

  // Create battle
  const mode                          = 'realtime' as Mode
  const [difficulty,  setDifficulty]  = useState<Difficulty>('medium')
  const questions                     = 10
  const [creating,    setCreating]    = useState(false)
  const [inviteCode,  setInviteCode]  = useState<string | null>(null)
  const [battleId,    setBattleId]    = useState<string | null>(null)

  // Join by code
  const [joinCode,    setJoinCode]    = useState('')
  const [joining,     setJoining]     = useState(false)

  // Random matchmaking
  const queueMode                     = 'realtime' as Mode
  const [queueDiff,   setQueueDiff]   = useState<Difficulty>('medium')
  const [inQueue,     setInQueue]     = useState(false)
  const [queueTime,   setQueueTime]   = useState(0)
  const queueTimeRef = useRef(0)
  const queueInterval                 = useRef<NodeJS.Timeout | null>(null)
  const pollInterval                  = useRef<NodeJS.Timeout | null>(null)

  const [error, setError] = useState<string | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (queueInterval.current) clearInterval(queueInterval.current)
      if (pollInterval.current)  clearInterval(pollInterval.current)
    }
  }, [])

  // ── CREATE BATTLE ─────────────────────────────────
  async function createBattle() {
    setCreating(true)
    setError(null)

    const res  = await fetch('/api/battles', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode, difficulty, question_count: questions }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setCreating(false); return }

    setInviteCode(data.battle.invite_code)
    setBattleId(data.battle.id)
    setCreating(false)
  }

  function goToBattle() {
    if (battleId) router.push(`/battle/${battleId}`)
  }

  // ── JOIN BY CODE ───────────────────────────────────
  async function joinByCode() {
    if (!joinCode.trim()) return
    setJoining(true)
    setError(null)

    const res  = await fetch('/api/battles/join', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ invite_code: joinCode }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setJoining(false); return }

    router.push(`/battle/${data.battle_id}`)
  }

  // ── RANDOM MATCHMAKING ────────────────────────────
  async function joinQueue() {
    setInQueue(true)
    setQueueTime(0)
    setError(null)

    queueInterval.current = setInterval(() => {
      setQueueTime(prev => {
        queueTimeRef.current = prev + 1
        return prev + 1
      })
    }, 1000)

    // Enter queue once
    const res  = await fetch('/api/matchmaking/queue', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode: queueMode, difficulty: queueDiff }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); leaveQueue(); return }

    if (data.matched) {
      leaveQueue()
      router.push(`/battle/${data.battle_id}`)
      return
    }

    // Poll for match every 2s
    pollInterval.current = setInterval(async () => {
      if (queueTimeRef.current >= 15) {
        clearInterval(pollInterval.current!)
        clearInterval(queueInterval.current!)

        try {
          const botRes  = await fetch('/api/matchmaking/bot', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              mode:           queueMode,
              difficulty:     queueDiff,
              bot_difficulty: queueDiff,
            }),
          })
          const botData = await botRes.json()

          if (botData.battle_id) {
            setInQueue(false)
            router.push(`/battle/${botData.battle_id}`)
          } else {
            setError(botData.error ?? 'Failed to start bot battle')
            setInQueue(false)
            setQueueTime(0)
          }
        } catch (err) {
          console.error('[joinQueue] bot fallback error:', err)
          setError('Failed to start bot battle')
          setInQueue(false)
          setQueueTime(0)
        }
        return
      }

      // Check for real player match
      const checkRes  = await fetch('/api/matchmaking/queue')
      const checkData = await checkRes.json()

      if (checkData.matched) {
        leaveQueue()
        router.push(`/battle/${checkData.battle_id}`)
      }
    }, 2000)
  }

  async function leaveQueue() {
    if (queueInterval.current) clearInterval(queueInterval.current)
    if (pollInterval.current)  clearInterval(pollInterval.current)
    setInQueue(false)
    setQueueTime(0)
    await fetch('/api/matchmaking/queue', { method: 'DELETE' })
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`



  // ── RENDER ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 p-4 pb-8">
      <div className="max-w-md mx-auto space-y-5 pt-8">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-black text-white">⚔️ Math Battle</h1>
          <p className="text-purple-300 text-sm">Choose how you want to play</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* ── QUICK BATTLE (primary CTA) ── */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-white font-bold text-lg">Quick Battle</h2>
            <span className="text-white/40 text-xs ml-auto">vs players · bot after 15s</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setQueueDiff(d)}
                className={`py-2 rounded-xl font-semibold text-sm transition-all ${
                  queueDiff === d
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'
                }`}>
                {d === 'easy' ? '🐢 Easy' : d === 'medium' ? '🐇 Medium' : '🚀 Hard'}
              </button>
            ))}
          </div>

          {inQueue ? (
            <div className="text-center space-y-3 py-2">
              <div className="flex items-center justify-center gap-3">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}/>
                  ))}
                </div>
                <p className="text-white font-bold">
                  {queueTime >= 12 ? '🤖 Starting vs AI...' : 'Finding opponent...'}
                </p>
                <span className="text-purple-300 font-mono text-sm">{formatTime(queueTime)}</span>
              </div>
              <button onClick={leaveQueue}
                className="text-red-400 hover:text-red-300 text-sm font-semibold transition">
                ✕ Cancel
              </button>
            </div>
          ) : (
            <button onClick={joinQueue}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-4 rounded-xl transition-all text-lg shadow-lg hover:-translate-y-0.5">
              Find Opponent 🎲
            </button>
          )}
        </div>

        {/* ── MODE CARDS ── */}
        <div className="grid grid-cols-2 gap-3">

          {/* Play a Friend – full width */}
          <div className="col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">👥</span>
              <h2 className="text-white font-bold">Play a Friend</h2>
            </div>

            {friendPanel === null && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setFriendPanel('create'); setInviteCode(null); setBattleId(null) }}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl text-sm transition">
                  🎯 Create Game
                </button>
                <button onClick={() => setFriendPanel('join')}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl text-sm transition">
                  🔗 Join by Code
                </button>
              </div>
            )}

            {friendPanel === 'create' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      className={`py-2 rounded-xl font-semibold text-xs transition-all ${
                        difficulty === d ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'
                      }`}>
                      {d === 'easy' ? '🐢 Easy' : d === 'medium' ? '🐇 Med' : '🚀 Hard'}
                    </button>
                  ))}
                </div>
                {inviteCode ? (
                  <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 text-center space-y-2">
                    <p className="text-green-300 text-xs">Share this code:</p>
                    <p className="text-white text-3xl font-bold tracking-widest">{inviteCode}</p>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(inviteCode)}
                        className="flex-1 text-green-300 hover:text-white text-xs transition bg-white/10 rounded-lg py-2">
                        📋 Copy
                      </button>
                      <button onClick={goToBattle}
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-2 rounded-lg text-xs transition">
                        Enter Room ⚔️
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setFriendPanel(null)}
                      className="bg-white/10 hover:bg-white/20 text-white/60 font-semibold py-3 rounded-xl text-sm transition px-4">
                      ←
                    </button>
                    <button onClick={createBattle} disabled={creating}
                      className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition">
                      {creating ? 'Creating...' : 'Create Battle ⚔️'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {friendPanel === 'join' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter code e.g. X4K9PZ"
                  maxLength={6}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-xl font-bold text-center tracking-widest placeholder-white/20 focus:outline-none focus:border-purple-400 transition uppercase"
                />
                <div className="flex gap-2">
                  <button onClick={() => setFriendPanel(null)}
                    className="bg-white/10 hover:bg-white/20 text-white/60 font-semibold py-3 rounded-xl text-sm transition px-4">
                    ←
                  </button>
                  <button onClick={joinByCode} disabled={joining || joinCode.length < 6}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition">
                    {joining ? 'Joining...' : 'Join Battle 🔗'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Practice – full width */}
          <Link href="/practice"
            className="col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/10 flex items-center gap-4 hover:bg-white/15 transition group">
            <span className="text-3xl">🎯</span>
            <div className="flex-1">
              <h2 className="text-white font-bold">Practice Mode</h2>
              <p className="text-white/40 text-xs mt-0.5">Solo drills — pick any topic, no pressure</p>
            </div>
            <div className="bg-white/10 group-hover:bg-white/20 text-white font-bold px-5 py-3 rounded-xl text-sm transition shrink-0">
              Start Practicing
            </div>
          </Link>

        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/leaderboard"
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-center transition">
            <p className="text-white font-semibold text-sm">🏆 Leaderboard</p>
          </Link>
          <Link href="/rewards"
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-center transition">
            <p className="text-white font-semibold text-sm">🃏 My Cards</p>
          </Link>
        </div>

      </div>
    </div>
  )
}
