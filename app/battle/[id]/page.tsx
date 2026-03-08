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

      setPlayers(prev => prev.map(p =>
        p.userId === pid
          ? { ...p, score: p.score + points, streak }
          : p
      ))
    }

    if (type === 'player:finished') {
      // Opponent finished — wait 2s then go to results
      setTimeout(() => {
        fetch(`/api/battles/${battleId}/finish`, { method: 'POST' })
          .then(() => router.push(`/results/${battleId}`))
      }, 2000)
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

    // Redirect to results after 3 seconds regardless
    const timeout = setTimeout(() => {
      fetch(`/api/battles/${battleId}/finish`, { method: 'POST' })
        .then(() => router.push(`/results/${battleId}`))
    }, 3000)

    return () => clearTimeout(timeout)
  }, [status, battleId, router])

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

      if (b.guest_id && b.status === 'waiting' && b.host_id === userIdRef.current) {
        clearInterval(interval)
        await fetch(`/api/battles/${battleId}/start`, { method: 'POST' })
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

      // If host loads and guest already joined but battle hasn't started, start it now
      if (battleData.status === 'waiting' && battleData.guest_id && battleData.host_id === user.id) {
        await fetch(`/api/battles/${battleId}/start`, { method: 'POST' })
      }

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

            // Only the host starts the battle
            if (userIdRef.current === updated.host_id) {
              await fetch(`/api/battles/${battleId}/start`, { method: 'POST' })
            }
          }

          // Battle started
          if (updated.status === 'active') {
            setBattle(updated)
            setStatus('active')

            // Fetch questions
            const { data: qs } = await supabase
              .from('battle_questions_safe')
              .select('*')
              .eq('battle_id', battleId)
              .order('sequence')

            if (qs && qs.length > 0) {
              setQuestions(qs as Question[])
              setServerSentAt(new Date().toISOString())
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(subscription) }
  }, [battleId, supabase])

  // Submit answer
  async function handleAnswer(answer: number) {
    if (answered || !questions[currentQ]) return
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
    if (!answered) {
      setAnswered(true)
      setPendingAnswer(null)
      setCorrectAnswer(null)
      setLastResult({ correct: false, points: 0 })
      setTimeout(() => {
        if (currentQ + 1 < questions.length) {
          setCurrentQ(prev => prev + 1)
          setAnswered(false)
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
            <h2 className="text-3xl font-bold text-white">Opponent found!</h2>
            <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-4">
              <p className="text-green-300 text-sm mb-3">Ready to battle</p>
              <div className="flex justify-center gap-8">
                {players.map(p => (
                  <div key={p.userId} className="text-center">
                    <div className="text-2xl mb-1">{p.userId === userId ? '⚔️' : '🛡️'}</div>
                    <p className="text-white text-sm font-bold">{p.username}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-purple-300 text-sm animate-pulse">
              ⏳ Starting battle...
            </p>
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

            {/* Card betting */}
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
          {reconnecting && (
            <span className="text-yellow-400 text-sm animate-pulse">🔄 Reconnecting...</span>
          )}
          <span className="text-purple-300 text-sm capitalize">
            {battle?.mode as string} · {battle?.difficulty as string}
          </span>
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
            paused={answered}
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