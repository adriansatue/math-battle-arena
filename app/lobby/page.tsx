'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Mode       = 'realtime' | 'turnbased'
type Difficulty = 'easy' | 'medium' | 'hard'
type Tab        = 'create' | 'join' | 'random'

export default function LobbyPage() {
  const router = useRouter()

  // Tab
  const [tab, setTab] = useState<Tab>('create')

  // Create battle
  const [mode,        setMode]        = useState<Mode>('realtime')
  const [difficulty,  setDifficulty]  = useState<Difficulty>('medium')
  const [questions,   setQuestions]   = useState(10)
  const [creating,    setCreating]    = useState(false)
  const [inviteCode,  setInviteCode]  = useState<string | null>(null)
  const [battleId,    setBattleId]    = useState<string | null>(null)

  // Join by code
  const [joinCode,    setJoinCode]    = useState('')
  const [joining,     setJoining]     = useState(false)

  // Random matchmaking
  const [queueMode,   setQueueMode]   = useState<Mode>('realtime')
  const [queueDiff,   setQueueDiff]   = useState<Difficulty>('medium')
  const [inQueue,     setInQueue]     = useState(false)
  const [queueTime,   setQueueTime]   = useState(0)
  const queueTimeRef = useRef(0)  // ← add this
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

  // ── CREATE BATTLE ────────────────────────────
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

  // ── JOIN BY CODE ─────────────────────────────
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

  // ── RANDOM MATCHMAKING ───────────────────────
  async function joinQueue() {
    setInQueue(true)
    setQueueTime(0)
    setError(null)

    queueInterval.current = setInterval(() => {
      setQueueTime(prev => {
        queueTimeRef.current = prev + 1  // ← keep ref updated
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
      // Use ref instead of queueTime (avoids stale closure)
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

  // ── RENDER ───────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-6xl font-black text-white drop-shadow-2xl">
            ⚔️ Math Battle Arena
          </h1>
          <p className="text-purple-200 text-lg">Choose your battle mode</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-2 flex gap-2">
          {(['create', 'join', 'random'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                tab === t
                  ? 'bg-white text-purple-900 shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}>
              {t === 'create' ? '🎯 Create' : t === 'join' ? '🔗 Join' : '🎲 Random'}
            </button>
          ))}
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 space-y-6 shadow-2xl">
          {/* ── CREATE TAB ── */}
          {tab === 'create' && (
            <>
              <div>
                <label className="text-purple-200 text-sm font-semibold block mb-2">Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['realtime', 'turnbased'] as Mode[]).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                        mode === m
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}>
                      {m === 'realtime' ? '⚡ Real-time' : '🔄 Turn-based'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-purple-200 text-sm font-semibold block mb-2">Difficulty</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                        difficulty === d
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}>
                      {d === 'easy' ? '🐢 Easy' : d === 'medium' ? '🐇 Medium' : '🚀 Hard'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-purple-200 text-sm font-semibold block mb-2">
                  Questions: <span className="text-white">{questions}</span>
                </label>
                <input type="range" min={5} max={20} step={5}
                  value={questions} onChange={e => setQuestions(Number(e.target.value))}
                  className="w-full accent-purple-500"/>
                <div className="flex justify-between text-white/30 text-xs mt-1">
                  <span>5</span><span>10</span><span>15</span><span>20</span>
                </div>
              </div>

              {inviteCode ? (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center space-y-3">
                  <p className="text-green-300 text-sm">Battle created! Share this code:</p>
                  <p className="text-white text-4xl font-bold tracking-widest">{inviteCode}</p>
                  <button onClick={() => navigator.clipboard.writeText(inviteCode)}
                    className="text-green-300 text-xs hover:text-white transition">
                    📋 Copy code
                  </button>
                  <button onClick={goToBattle}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 rounded-xl transition hover:-translate-y-0.5">
                    Enter Battle Room ⚔️
                  </button>
                </div>
              ) : (
                <button onClick={createBattle} disabled={creating}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all duration-200 shadow-lg hover:-translate-y-0.5 text-lg">
                  {creating ? 'Creating...' : 'Create Battle ⚔️'}
                </button>
              )}
            </>
          )}

          {/* ── JOIN TAB ── */}
          {tab === 'join' && (
            <>
              <div>
                <label className="text-purple-200 text-sm font-semibold block mb-2">
                  Enter Invite Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. X4K9PZ"
                  maxLength={6}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white text-2xl font-bold text-center tracking-widest placeholder-white/20 focus:outline-none focus:border-purple-400 transition uppercase"
                />
              </div>
              <button
                onClick={joinByCode}
                disabled={joining || joinCode.length < 6}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all text-lg"
              >
                {joining ? 'Joining...' : 'Join Battle 🔗'}
              </button>
              <p className="text-white/30 text-xs text-center">
                Ask your friend for their 6-character invite code
              </p>
            </>
          )}

          {/* ── RANDOM TAB ── */}
          {tab === 'random' && (
            <>
              {!inQueue ? (
                <>
                  <div>
                    <label className="text-purple-200 text-sm font-semibold block mb-2">Mode</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['realtime', 'turnbased'] as Mode[]).map(m => (
                        <button key={m} onClick={() => setQueueMode(m)}
                          className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                            queueMode === m
                              ? 'bg-purple-600 text-white'
                              : 'bg-white/10 text-white/60 hover:bg-white/20'
                          }`}>
                          {m === 'realtime' ? '⚡ Real-time' : '🔄 Turn-based'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-purple-200 text-sm font-semibold block mb-2">Difficulty</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                        <button key={d} onClick={() => setQueueDiff(d)}
                          className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                            queueDiff === d
                              ? 'bg-purple-600 text-white'
                              : 'bg-white/10 text-white/60 hover:bg-white/20'
                          }`}>
                          {d === 'easy' ? '🐢 Easy' : d === 'medium' ? '🐇 Medium' : '🚀 Hard'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={joinQueue}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-4 rounded-xl transition-all text-lg">
                    Find Opponent 🎲
                  </button>
                </>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="text-5xl animate-bounce">🔍</div>
                  <p className="text-white font-bold text-xl">Finding opponent...</p>
                  <p className="text-purple-300 text-sm">
                    {queueMode === 'realtime' ? '⚡ Real-time' : '🔄 Turn-based'} ·{' '}
                    {queueDiff === 'easy' ? '🐢 Easy' : queueDiff === 'medium' ? '🐇 Medium' : '🚀 Hard'}
                  </p>
                  <div className="bg-white/10 rounded-xl py-3 px-6 inline-block">
                    <p className="text-white font-mono text-2xl">{formatTime(queueTime)}</p>
                    <p className="text-purple-300 text-xs">
                      {queueTime >= 12
                        ? '⚡ Starting vs AI bot...'
                        : queueTime >= 8
                        ? '🤖 No opponent found, preparing AI...'
                        : 'searching...'}
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center mt-2">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}/>
                    ))}
                  </div>
                  <button onClick={leaveQueue}
                    className="text-red-400 hover:text-red-300 text-sm font-semibold transition mt-4 block mx-auto">
                    ✕ Cancel Search
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}