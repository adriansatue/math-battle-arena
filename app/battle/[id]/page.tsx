'use client'

import { useEffect, useState, useCallback, use, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBattleChannel } from '@/lib/realtime/useBattleChannel'
import { Timer }        from '@/components/battle/Timer'
import { QuestionCard } from '@/components/battle/QuestionCard'
import { ScoreBar }     from '@/components/battle/ScoreBar'
import { CardStakeSelector, InventoryItem } from '@/components/battle/CardStakeSelector'

type StakedCardInfo = { name: string; rarity: 'common' | 'uncommon' | 'rare' | 'legendary'; image_url: string }

interface Question {
  id:            string
  sequence:      number
  question_text: string
  category:      string
}

interface Player {
  userId:   string
  username: string
  score:    number
  streak:   number
  online:   boolean
}

interface LastResult {
  correct: boolean
  points:  number
}

export default function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: battleId } = use(params)
  const router           = useRouter()
  // useMemo ensures the same supabase instance across re-renders so subscription effects stay stable
  const supabase         = useMemo(() => createClient(), [])

  const [userId,      setUserId]      = useState('')
  const [username,    setUsername]    = useState('')
  const [battle,      setBattle]      = useState<Record<string, unknown> | null>(null)
  const [questions,   setQuestions]   = useState<Question[]>([])
  const [currentQ,    setCurrentQ]    = useState(0)
  const [players,     setPlayers]     = useState<Player[]>([])
  const [answered,    setAnswered]    = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [lastResult,  setLastResult]  = useState<LastResult | null>(null)
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null)
  const [status,      setStatus]      = useState<'waiting' | 'active' | 'finished'>('waiting')
  const [serverSentAt, setServerSentAt] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [opponentFinished, setOpponentFinished] = useState(false)
  const [starting,    setStarting]    = useState(false)
  const [startError,  setStartError]  = useState<string | null>(null)
  const [paused,      setPaused]      = useState(false)

  // Synchronous guard against timer/click race (same fix as practice page)
  const answeredRef = useRef(false)

  // Ref so the stable subscription callback always reads the latest userId
  const userIdRef = useRef('')
  useEffect(() => { userIdRef.current = userId }, [userId])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [myStakedCard,       setMyStakedCard]       = useState<InventoryItem | null>(null)
  const [opponentStakedCard, setOpponentStakedCard] = useState<StakedCardInfo | null>(null)

  // Handle realtime events
  const handleEvent = useCallback(({ type, payload }: {
    type: string
    payload: Record<string, unknown>
  }) => {
    if (type === 'answer:result') {
      const pid    = payload.player_id as string
      const points = payload.points_earned as number
      const streak = payload.current_streak as number

      // Supabase broadcast echoes back to the sender — skip own events
      // (own score is already updated directly in handleAnswer)
      if (pid === userIdRef.current) return

      setPlayers(prev => prev.map(p =>
        p.userId === pid
          ? { ...p, score: p.score + points, streak }
          : p
      ))
    }

    if (type === 'player:finished') {
      // Mark opponent as done. Only redirect if the local player has also finished.
      // This prevents kicking a player out mid-game when the opponent finishes first.
      setOpponentFinished(true)
    }

    if (type === 'battle:end') {
      router.push(`/results/${battleId}`)
    }
  }, [battleId, router])

  // Handle presence
  const handlePresence = useCallback((presenceUsers: { user_id: string; username: string; online: boolean }[]) => {
    setPlayers(prev => prev.map(p => {
      const found = presenceUsers.find(u => u.user_id === p.userId)
      return found ? { ...p, online: found.online } : p
    }))
    const wasReconnecting = reconnecting
    if (wasReconnecting) setReconnecting(false)
  }, [reconnecting])

  const { broadcast } = useBattleChannel({
    battleId,
    userId,
    username,
    onEvent:    handleEvent,
    onPresence: handlePresence,
  })

  // When current player finishes, redirect to results after a short delay
  useEffect(() => {
    if (status !== 'finished') return

    // Give the opponent a couple of seconds after we finish; then end regardless
    const delay = opponentFinished ? 1500 : 3000
    const timeout = setTimeout(async () => {
      try {
        // Call finish to finalize the battle and update scores
        const finishRes = await fetch(`/api/battles/${battleId}/finish`, { method: 'POST' })
        if (finishRes.ok) {
          // Small delay to ensure DB is updated before redirect
          await new Promise(resolve => setTimeout(resolve, 100))
          router.push(`/results/${battleId}`)
        }
      } catch (err) {
        console.error('Finish error:', err)
        // Redirect anyway after a delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        router.push(`/results/${battleId}`)
      }
    }, delay)

    return () => clearTimeout(timeout)
  }, [status, opponentFinished, battleId, router])

  // Polling fallback: while waiting, check every 3s if guest joined and start if so
  // This backs up the Realtime path which can miss the event after a re-render
  useEffect(() => {
    if (status !== 'waiting') return

    const interval = setInterval(async () => {
      const { data: b } = await supabase
        .from('battles')
        .select('id, status, host_id, guest_id')
        .eq('id', battleId)
        .single()

      if (!b) return

      if (b.status === 'active') {
        // Battle already started (Realtime handled it), just clear the poll
        clearInterval(interval)
        return
      }

      if (b.guest_id && b.status === 'waiting') {
        // Guest joined — just update local state, host will start manually
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [status, battleId, supabase])

  // Load user + battle data
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      setUsername(profile?.username ?? 'Player')

      // Fetch battle
      const { data: battleData } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single()
      if (!battleData) { router.push('/lobby'); return }
      setBattle(battleData)
      setStatus(battleData.status as 'waiting' | 'active' | 'finished')

      // Fetch questions (safe view — no correct_answer)
      const { data: qs } = await supabase
        .from('battle_questions_safe')
        .select('*')
        .eq('battle_id', battleId)
        .order('sequence')
      setQuestions((qs as Question[]) ?? [])

      // Fetch both player profiles
      const playerIds = [battleData.host_id, battleData.guest_id].filter(Boolean)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', playerIds)

      // Fetch current scores from answers
      const { data: answers } = await supabase
        .from('battle_answers')
        .select('player_id, points_earned, is_correct')
        .eq('battle_id', battleId)

      const scoreTotals: Record<string, number> = {}
      const streaks: Record<string, number> = {}
      for (const ans of (answers ?? [])) {
        scoreTotals[ans.player_id] = (scoreTotals[ans.player_id] ?? 0) + ans.points_earned
      }

      setPlayers((profiles ?? []).map((p: { id: string; username: string }) => ({
        userId:   p.id,
        username: p.username,
        score:    scoreTotals[p.id] ?? 0,
        streak:   streaks[p.id] ?? 0,
        online:   true,
      })))

      // Set current question index
      if (battleData.status === 'active' && qs && qs.length > 0) {
        const answeredCount = answers?.filter((a: { player_id: string }) =>
          a.player_id === user.id
        ).length ?? 0
        setCurrentQ(Math.min(answeredCount, qs.length - 1))
        // Always use fresh timestamp — ignore stale server_sent_at from DB
        setServerSentAt(new Date().toISOString())
      }
    }
    load()
  }, [battleId, router, supabase])

  // Watch for opponent joining + battle status changes
  useEffect(() => {
    if (!battleId) return

    const subscription = supabase
      .channel(`battle-status-${battleId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'battles',
          filter: `id=eq.${battleId}`,
        },
        async (payload) => {
          const updated = payload.new as Record<string, unknown>

          // Check opponent's staked card
          const isHost = userIdRef.current === updated.host_id
          const opponentStakedId = isHost
            ? updated.guest_staked_inventory_id
            : updated.host_staked_inventory_id

          if (opponentStakedId) {
            const { data } = await supabase
              .from('user_inventory')
              .select('reward_catalog(name, rarity, image_url)')
              .eq('id', opponentStakedId)
              .single()
            if (data) setOpponentStakedCard((data as unknown as { reward_catalog: StakedCardInfo }).reward_catalog)
          }

          // Opponent just joined — host auto-starts the battle
          if (updated.guest_id && updated.status === 'waiting') {
            setBattle(updated)
            setPlayers(prev => {
              if (prev.find(p => p.userId === updated.guest_id)) return prev
              return [...prev, {
                userId:   updated.guest_id as string,
                username: 'Opponent',
                score:    0,
                streak:   0,
                online:   true,
              }]
            })

          }

          // Battle started
          if (updated.status === 'active') {
            setBattle(updated)
            setStatus('active')

            // Fetch questions — retry once with a delay to handle the race where
            // the Realtime event arrives before questions are fully readable in the DB.
            const fetchQuestions = async (attempt = 1) => {
              const { data: qs } = await supabase
                .from('battle_questions_safe')
                .select('*')
                .eq('battle_id', battleId)
                .order('sequence')

              if (qs && qs.length > 0) {
                setQuestions(qs as Question[])
                setServerSentAt(new Date().toISOString())
              } else if (attempt < 4) {
                // Retry with back-off: 500ms, 1000ms, 2000ms
                setTimeout(() => fetchQuestions(attempt + 1), attempt * 500)
              }
            }
            fetchQuestions()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(subscription) }
  }, [battleId, supabase])

  // Host manually starts the battle
  async function startBattle() {
    setStarting(true)
    setStartError(null)
    const res = await fetch(`/api/battles/${battleId}/start`, { method: 'POST' })
    
    if (!res.ok) {
      const d = await res.json()
      setStartError(
        d.error === 'bet_not_matched'
          ? '⚠️ Waiting for opponent to match your card bet first'
          : (d.message ?? d.error ?? 'Failed to start')
      )
      setStarting(false)
      return
    }

    // Success: Update battle status immediately and fetch questions
    setStatus('active')
    
    // Fetch questions immediately
    const { data: qs } = await supabase
      .from('battle_questions_safe')
      .select('*')
      .eq('battle_id', battleId)
      .order('sequence')
    
    if (qs && qs.length > 0) {
      setQuestions(qs as Question[])
      setServerSentAt(new Date().toISOString())
    }
    
    setStarting(false)
  }

  // Submit answer
  async function handleAnswer(answer: number) {
    if (answeredRef.current || answered || paused || !questions[currentQ]) return
    answeredRef.current = true
    setAnswered(true)
    setPendingAnswer(answer)   // ← show immediately, before server responds

    const sentAt = Date.now()

    const res = await fetch(`/api/battles/${battleId}/answer`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        question_id:   questions[currentQ].id,
        answer_given:  answer,
        time_taken_ms: serverSentAt
          ? Date.now() - new Date(serverSentAt).getTime()
          : Date.now() - sentAt,
      }),
    })

    const data = await res.json()

    // Even on API error, always advance so the game never gets stuck
    const isCorrect   = data.is_correct ?? false
    const pointsEarned = data.points_earned ?? 0

    if (data.is_correct !== undefined || !res.ok) {
      if (data.is_correct !== undefined) {
      // Update own score locally
      setPlayers(prev => prev.map(p =>
        p.userId === userId
          ? { ...p, score: p.score + pointsEarned, streak: data.current_streak ?? 0 }
          : p
      ))

      setLastResult({ correct: isCorrect, points: pointsEarned })
      setCorrectAnswer(!isCorrect && data.correct_answer != null ? data.correct_answer : null)

      // Broadcast to opponent
      await broadcast('answer:result', {
        player_id:      userId,
        is_correct:     isCorrect,
        points_earned:  pointsEarned,
        current_streak: data.current_streak ?? 0,
      })

      // If playing vs bot, trigger bot answer after a delay
      if (battle?.bot_id) {
        const currentQuestion = questions[currentQ]
        if (currentQuestion) {
          setTimeout(async () => {
            await fetch(`/api/battles/${battleId}/bot`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                question_id:    currentQuestion.id,
                bot_difficulty: battle.difficulty,
              }),
            }).then(r => r.json()).then(botData => {
              if (botData.points_earned !== undefined) {
                setPlayers(prev => prev.map(p =>
                  p.userId === (battle.bot_id as string)
                    ? { ...p, score: p.score + (botData.points_earned ?? 0) }
                    : p
                ))
              }
            })
          }, 1000 + Math.random() * 3000)
        }
      }
      }

      setTimeout(() => {
        if (currentQ + 1 < questions.length) {
          const freshTimestamp = new Date().toISOString()
          setCurrentQ(prev => prev + 1)
          setAnswered(false)
          answeredRef.current = false
          setLastResult(null)
          setPendingAnswer(null)
          setCorrectAnswer(null)
          setServerSentAt(freshTimestamp)
        } else {
          // Signal this player is done
          broadcast('player:finished', { player_id: userId })
          setStatus('finished')
        }
      }, 1200)
    }
  }

  function handleTimerExpire() {
    if (answeredRef.current || answered) return
    answeredRef.current = true
    setAnswered(true)
    setPendingAnswer(null)
    setCorrectAnswer(null)
    setLastResult({ correct: false, points: 0 })
    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ(prev => prev + 1)
        setAnswered(false)
        answeredRef.current = false
        setLastResult(null)
        setPendingAnswer(null)
        setCorrectAnswer(null)
        setServerSentAt(new Date().toISOString())
      } else {
        broadcast('player:finished', { player_id: userId })
        setStatus('finished')
      }
    }, 1000)
  }

  // ── WAITING STATE ──────────────────────────
  if (status === 'waiting') {
  const hasOpponent = battle?.guest_id != null

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center p-4">
      <div className="text-center space-y-6 w-full max-w-sm">
        <div className="text-6xl animate-bounce">⚔️</div>

        {hasOpponent ? (
          <>
            <h2 className="text-2xl font-bold text-white">⚔️ Opponent found!</h2>

            {/* Players */}
            <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
              <div className="flex justify-center gap-12">
                {players.map(p => (
                  <div key={p.userId} className="text-center">
                    <div className="text-2xl mb-1">{p.userId === userId ? '⚔️' : '🛡️'}</div>
                    <p className="text-white text-sm font-bold">{p.username}</p>
                    <p className="text-white/40 text-xs">{p.userId === userId ? 'You' : 'Opponent'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Card betting — both players see this */}
            <CardStakeSelector
              battleId={battleId}
              isHost={userId === battle?.host_id as string}
              opponentStakedCard={opponentStakedCard}
              onStaked={setMyStakedCard}
            />

            {/* Host gets Start button; guest waits */}
            {userId === battle?.host_id as string ? (
              <div className="space-y-2">
                {startError && (
                  <p className="text-yellow-300 text-sm text-center animate-pulse">{startError}</p>
                )}
                <button
                  onClick={startBattle}
                  disabled={starting}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-lg shadow-lg transition"
                >
                  {starting ? '⏳ Starting...' : '⚔️ Start Battle!'}
                </button>
                <p className="text-white/30 text-xs text-center">Card wager is optional — you can start without one</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-purple-300 text-sm animate-pulse">⏳ Waiting for host to start the battle...</p>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold text-white">Waiting for opponent...</h2>
            <p className="text-purple-300">Share your invite code to get started</p>
            <div className="bg-white/10 rounded-2xl p-4 border border-white/20 inline-block">
              <p className="text-purple-300 text-sm mb-1">Invite Code</p>
              <p className="text-white text-3xl font-bold tracking-widest">
                {battle?.invite_code as string ?? '...'}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(battle?.invite_code as string ?? '')}
                className="text-purple-300 text-xs hover:text-white transition mt-2 block mx-auto"
              >
                📋 Copy code
              </button>
            </div>

            {/* Card betting (host alone — before opponent joins) */}
            <CardStakeSelector
              battleId={battleId}
              isHost={userId === battle?.host_id as string}
              opponentStakedCard={opponentStakedCard}
              onStaked={setMyStakedCard}
            />
          </>
        )}
      </div>
    </div>
  )
  }

  const q = questions[currentQ]
  if (!q) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">Loading battle...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-white font-bold text-lg">⚔️ Battle Arena</h1>
          <div className="flex items-center gap-3">
            {reconnecting && (
              <span className="text-yellow-400 text-sm animate-pulse">🔄 Reconnecting...</span>
            )}
            <span className="text-purple-300 text-sm capitalize">
              {battle?.mode as string} · {battle?.difficulty as string}
            </span>
            <button
              onClick={() => setPaused(true)}
              aria-label="Pause battle"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-lg transition"
            >
              ⏸
            </button>
          </div>
        </div>

        {/* Scores */}
        {players.length > 0 && (
          <ScoreBar players={players} currentUserId={userId} />
        )}

        {/* Timer — centered */}
        <div className="flex justify-center">
          <Timer
            durationSecs={battle?.time_per_q_secs as number ?? 10}
            serverSentAt={serverSentAt}
            onExpire={handleTimerExpire}
            paused={answered || paused}
          />
        </div>

        {/* Question — full width */}
        <QuestionCard
              sequence={currentQ + 1}
              total={questions.length}
              questionText={q.question_text}
              onAnswer={handleAnswer}
              disabled={answered}
              lastResult={lastResult}
              pendingAnswer={pendingAnswer}
              correctAnswer={correctAnswer}
            />

      </div>

      {/* Pause modal */}
      {paused && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-indigo-950 border border-white/20 rounded-2xl p-8 text-center shadow-2xl w-full max-w-xs mx-4 space-y-5">
            <div className="text-5xl">⏸</div>
            <h2 className="text-2xl font-bold text-white">Game Paused</h2>
            <p className="text-purple-300 text-sm">Your timer is paused while you decide.</p>
            <button
              onClick={() => setPaused(false)}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold py-3 rounded-2xl text-lg transition"
            >
              ▶️ Resume Battle
            </button>
            <button
              onClick={() => router.push('/lobby')}
              className="w-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white font-semibold py-3 rounded-2xl text-base transition"
            >
              🚪 Leave Battle
            </button>
            <p className="text-white/30 text-xs">Leaving counts as a forfeit</p>
          </div>
        </div>
      )}

      {/* Waiting for opponent overlay */}
      {status === 'finished' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 rounded-2xl p-8 text-center border border-white/20">
            <div className="text-5xl mb-4 animate-bounce">⏳</div>
            <h2 className="text-2xl font-bold text-white mb-2">You finished!</h2>
            <p className="text-purple-300">Waiting for opponent to finish...</p>
            <div className="flex gap-2 justify-center mt-4">
              {[0,1,2].map(i => (
                <div key={i}
                  className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}