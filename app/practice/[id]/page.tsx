'use client'

import { use, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Timer }        from '@/components/battle/Timer'
import { QuestionCard } from '@/components/battle/QuestionCard'
import { PackOpener }   from '@/components/cards/PackOpener'
import { generateWrongAnswers } from '@/lib/game/questions'
import Link from 'next/link'

interface Question {
  id:            string
  sequence:      number
  question_text: string
  category:      string
  server_sent_at?: string
}

interface Result {
  correct:       boolean
  points:        number
  correctAnswer?: number
}

interface PackCard {
  id:          string
  name:        string
  description: string
  rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
  image_url:   string
}

interface Summary {
  total:    number
  correct:  number
  points:   number
  accuracy: number
  avgMs:    number
}

export default function PracticeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: battleId } = use(params)
  const router      = useRouter()
  const supabase    = createClient()
  const searchParams = useSearchParams()
  const answerMode  = (searchParams.get('mode') ?? 'typed') as 'typed' | 'multiple_choice'
  const POINTS_MULTIPLIER = answerMode === 'multiple_choice' ? 0.6 : 1.0

  const [,             setUserId]       = useState('')
  const [battle,       setBattle]       = useState<Record<string, unknown> | null>(null)
  const [questions,    setQuestions]    = useState<Question[]>([])
  const [currentQ,     setCurrentQ]     = useState(0)
  const [answered,     setAnswered]     = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [lastResult,   setLastResult]   = useState<Result | null>(null)
  const [serverSentAt, setServerSentAt] = useState<string | null>(null)
  const [score,        setScore]        = useState(0)
  const [streak,       setStreak]       = useState(0)
  const [results,      setResults]      = useState<Result[]>([])
  const [finished,     setFinished]     = useState(false)
  const [summary,      setSummary]      = useState<Summary | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [mcOptions,    setMcOptions]    = useState<number[]>([])
  const [mcSelected,   setMcSelected]   = useState<number | null>(null)
  const [profilePoints, setProfilePoints] = useState<number | null>(null)
  const [opening,       setOpening]       = useState(false)
  const [packCards,     setPackCards]     = useState<PackCard[]>([])
  const [showPack,      setShowPack]      = useState(false)
  const [packError,     setPackError]     = useState<string | null>(null)
  const timingsRef   = useRef<number[]>([])
  const answeredRef  = useRef(false)   // synchronous guard against timer/click race

  async function fetchMcOptions(questionId: string): Promise<number[]> {
    const { data } = await supabase
      .from('battle_questions')
      .select('correct_answer')
      .eq('id', questionId)
      .single()
    if (!data) return []
    const correct = Number(data.correct_answer)
    const wrong   = generateWrongAnswers(correct, 3)
    return [...wrong, correct].sort(() => Math.random() - 0.5)
  }

  useEffect(() => {
    if (answerMode === 'multiple_choice' && questions[currentQ]) {
      fetchMcOptions(questions[currentQ].id).then(setMcOptions)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, questions, answerMode])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: b } = await supabase
        .from('battles').select('*').eq('id', battleId).single()
      if (!b) { router.push('/practice'); return }
      setBattle(b)

      const { data: qs } = await supabase
        .from('battle_questions_safe')
        .select('*')
        .eq('battle_id', battleId)
        .order('sequence')
      setQuestions((qs as Question[]) ?? [])
      setServerSentAt(new Date().toISOString())
      setLoading(false)
    }
    load()
  }, [battleId, router, supabase])

  const finishSession = useCallback((allResults: Result[]) => {
    fetch(`/api/battles/${battleId}/finish`, { method: 'POST' })
    const correct  = allResults.filter(r => r.correct).length
    const total    = allResults.length
    const pts      = allResults.reduce((s, r) => s + r.points, 0)
    const avgMs    = timingsRef.current.length
      ? Math.round(timingsRef.current.reduce((a, b) => a + b, 0) / timingsRef.current.length)
      : 0

    setSummary({
      total,
      correct,
      points:   pts,
      accuracy: Math.round((correct / total) * 100),
      avgMs,
    })
    setFinished(true)

    // Fetch updated profile points after a short delay to let the finish API settle
    setTimeout(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data: profile } = await sb
          .from('profiles')
          .select('total_points')
          .eq('id', user.id)
          .single()
        if (profile) setProfilePoints(profile.total_points)
      }
    }, 800)
  }, [battleId])

  const handleAnswer = useCallback(async (answer: number) => {
    if (answeredRef.current || answered || !questions[currentQ]) return
    answeredRef.current = true
    setAnswered(true)
    setPendingAnswer(answer)

    const timeTakenMs = serverSentAt
      ? Date.now() - new Date(serverSentAt).getTime()
      : 5000

    timingsRef.current.push(timeTakenMs)

    const res  = await fetch(`/api/battles/${battleId}/answer`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        question_id:  questions[currentQ].id,
        answer_given: answer,
        time_taken_ms: timeTakenMs,
      }),
    })
    const data = await res.json()

    const result: Result = {
      correct:       data.is_correct ?? false,
      points:        data.points_earned ?? 0,
      correctAnswer: data.correct_answer,
    }

    const adjustedPoints = result.correct
      ? Math.round(result.points * POINTS_MULTIPLIER)
      : 0
    const adjustedResult: Result = { ...result, points: adjustedPoints }

    setLastResult(adjustedResult)

    if (adjustedResult.correct) {
      setScore(prev => prev + adjustedPoints)
      setStreak(prev => prev + 1)
      setResults(prev => [...prev, adjustedResult])
    } else {
      setStreak(0)
      setResults(prev => [...prev, adjustedResult])
    }

    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ(prev => prev + 1)
        setAnswered(false)
        answeredRef.current = false
        setPendingAnswer(null)
        setLastResult(null)
        setMcSelected(null)
        setServerSentAt(new Date().toISOString())
      } else {
        finishSession([...results, adjustedResult])
      }
    }, 1200)
  }, [answered, questions, currentQ, serverSentAt, battleId, results, finishSession, POINTS_MULTIPLIER])

  function handleTimerExpire() {
    if (answeredRef.current || answered) return
    answeredRef.current = true
    setAnswered(true)
    setPendingAnswer(null)
    const result: Result = { correct: false, points: 0 }
    setLastResult(result)
    setResults(prev => [...prev, result])
    setStreak(0)
    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ(prev => prev + 1)
        setAnswered(false)
        answeredRef.current = false
        setPendingAnswer(null)
        setLastResult(null)
        setMcSelected(null)
        setServerSentAt(new Date().toISOString())
      } else {
        finishSession([...results, result])
      }
    }, 1000)
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse text-xl">Loading practice...</div>
    </div>
  )

  async function openPack(packType: 'basic' | 'rare' | 'legendary') {
    setOpening(true)
    setPackError(null)
    const res  = await fetch('/api/rewards/open-pack', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pack_type: packType }),
    })
    const data = await res.json()
    if (!res.ok) { setPackError(data.error); setOpening(false); return }
    const costs = { basic: 500, rare: 2000, legendary: 5000 }
    setPackCards(data.cards)
    setProfilePoints(prev => prev !== null ? prev - costs[packType] : null)
    setShowPack(true)
    setOpening(false)
  }

  // ── SUMMARY SCREEN ──────────────────────────────
  if (finished && summary) {
    const stars = summary.accuracy >= 90 ? 5 :
                  summary.accuracy >= 75 ? 4 :
                  summary.accuracy >= 60 ? 3 :
                  summary.accuracy >= 40 ? 2 : 1

    const PACKS = [
      { id: 'basic',     label: 'Basic',     emoji: '📦', cost: 500,  color: 'from-slate-400 to-slate-500',   glow: 'shadow-slate-400/20' },
      { id: 'rare',      label: 'Rare',      emoji: '💎', cost: 2000, color: 'from-blue-400 to-cyan-500',     glow: 'shadow-blue-400/20'  },
      { id: 'legendary', label: 'Legendary', emoji: '👑', cost: 5000, color: 'from-yellow-400 to-amber-500',  glow: 'shadow-yellow-400/20' },
    ]

    const perfLabel = summary.accuracy >= 90 ? 'Outstanding! 🔥' :
                      summary.accuracy >= 75 ? 'Great work!' :
                      summary.accuracy >= 60 ? 'Keep it up!' : 'Keep practicing!'

    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">

        {/* Background glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl"/>
        </div>

        <div className="w-full max-w-md relative">

          {/* Trophy / icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-2xl shadow-yellow-500/30 mb-4 text-4xl">
              {summary.accuracy >= 80 ? '🏆' : summary.accuracy >= 60 ? '💪' : '📚'}
            </div>
            <h1 className="text-4xl font-black text-white mb-1 tracking-tight">Practice Complete!</h1>
            <p className="text-purple-300 text-sm font-semibold">{perfLabel}</p>
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-2 mb-6">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={`text-3xl transition-all ${i <= stars ? 'opacity-100 drop-shadow-[0_0_6px_rgba(250,204,21,0.7)]' : 'opacity-15'}`}>
                ⭐
              </span>
            ))}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Correct',    value: `${summary.correct}/${summary.total}`, emoji: '✅', sub: `${summary.accuracy}% accuracy` },
              { label: 'Avg Speed',  value: `${(summary.avgMs / 1000).toFixed(1)}s`, emoji: '⚡', sub: 'per question' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-1">{stat.emoji}</div>
                <div className="text-white font-black text-2xl">{stat.value}</div>
                <div className="text-white/40 text-xs mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Points earned + total balance */}
          <div className="bg-gradient-to-r from-violet-600/20 to-purple-600/10 border border-violet-500/30 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-0.5">Earned this session</p>
                <p className="text-3xl font-black text-yellow-400">+{summary.points.toLocaleString()} <span className="text-base font-bold text-yellow-400/60">pts</span></p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-0.5">Your total</p>
                {profilePoints !== null ? (
                  <p className="text-3xl font-black text-white">{profilePoints.toLocaleString()} <span className="text-base font-bold text-white/40">pts</span></p>
                ) : (
                  <p className="text-2xl font-black text-white/30 animate-pulse">...</p>
                )}
              </div>
            </div>
          </div>

          {/* Pack affordability */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-6">
            <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-3">Packs you can open</p>
            {packError && (
              <p className="text-red-400 text-xs mb-3 text-center">{packError}</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {PACKS.map(pack => {
                const canAfford  = profilePoints !== null ? Math.floor(profilePoints / pack.cost) : null
                const affordable = canAfford !== null && canAfford > 0
                return (
                  <div key={pack.id} className={`rounded-xl p-3 text-center border transition-all ${
                    affordable
                      ? `bg-gradient-to-b ${pack.color} bg-opacity-10 border-white/20 shadow-lg ${pack.glow}`
                      : 'bg-white/[0.02] border-white/[0.06]'
                  }`}>
                    <div className="text-2xl mb-1">{pack.emoji}</div>
                    <p className={`text-xs font-bold mb-0.5 ${affordable ? 'text-white' : 'text-white/30'}`}>{pack.label}</p>
                    <p className={`text-xs mb-2 ${affordable ? 'text-white/50' : 'text-white/20'}`}>{pack.cost.toLocaleString()} pts</p>
                    <button
                      onClick={() => affordable && !opening && openPack(pack.id as 'basic' | 'rare' | 'legendary')}
                      disabled={!affordable || opening || profilePoints === null}
                      className={`w-full rounded-lg py-1.5 text-xs font-black transition-all ${
                        affordable && !opening
                          ? 'bg-white/25 hover:bg-white/40 text-white active:scale-95 cursor-pointer'
                          : 'bg-white/5 text-white/20 cursor-not-allowed'
                      }`}
                    >
                      {canAfford === null ? '...' :
                       opening ? '⏳' :
                       affordable ? `Open ×${canAfford}` : '✕'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Per-question breakdown */}
          <div className="flex gap-1 justify-center flex-wrap mb-6">
            {results.map((r, i) => (
              <div key={i} className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold ${
                r.correct ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'
              }`}>
                {r.correct ? '✔' : '✗'}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Link href="/practice"
              className="flex-1 bg-white/[0.06] hover:bg-white/[0.10] border border-white/10 text-white font-bold py-4 rounded-2xl transition text-center text-sm">
              🔄 Practice Again
            </Link>
            <Link href="/lobby"
              className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold py-4 rounded-2xl transition text-center text-sm shadow-lg shadow-purple-500/30 hover:-translate-y-0.5">
              ⚔️ Battle!
            </Link>
          </div>

        </div>

        {/* Pack opener overlay */}
        {showPack && packCards.length > 0 && (
          <PackOpener
            cards={packCards}
            onClose={() => setShowPack(false)}
          />
        )}
      </div>
    )
  }

  const q = questions[currentQ]
  if (!q) return null

  // ── PRACTICE SCREEN ─────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex flex-col">

      {/* Top nav */}
      <div className="w-full max-w-lg mx-auto px-4 pt-5 pb-3 flex items-center justify-between">
        <button onClick={() => router.push('/practice')}
          className="flex items-center gap-1.5 text-purple-300 hover:text-white text-sm font-medium transition">
          ← Back
        </button>
        <span className="text-white/40 text-xs capitalize tracking-wide">
          {q.category?.replace('_', ' ')} · {battle?.difficulty as string}
        </span>
        <div className="text-right min-w-[52px]">
          <p className="text-white font-bold text-sm">{score} <span className="text-white/40 font-normal text-xs">pts</span></p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="w-full max-w-lg mx-auto px-4 mb-5">
        <div className="flex gap-1.5 justify-center">
          {questions.map((_, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${
              i < currentQ   ? 'w-6 h-2 bg-purple-500' :
              i === currentQ ? 'w-6 h-2 bg-white' :
                               'w-2 h-2 bg-white/20'
            }`}/>
          ))}
        </div>
      </div>

      {/* Main content — centered column */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 flex flex-col gap-4">

        {/* Timer row: streak · timer · question count */}
        <div className="flex items-center justify-between">
          <div className="w-16">
            {streak >= 3 && (
              <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/30 rounded-xl px-2.5 py-1.5">
                <span className="text-base">🔥</span>
                <span className="text-orange-300 text-xs font-bold">{streak}x</span>
              </div>
            )}
          </div>

          <Timer
            durationSecs={battle?.time_per_q_secs as number ?? 15}
            serverSentAt={serverSentAt}
            onExpire={handleTimerExpire}
            paused={answered}
          />

          <div className="w-16 text-right">
            <span className="text-white/30 text-xs">{currentQ + 1}<span className="text-white/15">/{questions.length}</span></span>
          </div>
        </div>

        {/* Question card */}
        <div className={`rounded-3xl border-2 text-center px-8 py-8 transition-all duration-300 ${
          answered && lastResult?.correct === true  ? 'border-green-400/60 bg-green-500/10 shadow-lg shadow-green-900/20' :
          answered && lastResult?.correct === false ? 'border-red-400/60 bg-red-500/10 shadow-lg shadow-red-900/20' :
          'border-white/10 bg-white/5'
        }`}>
          <p className="text-white font-black text-5xl tracking-tight leading-none">
            {q.question_text} = ?
          </p>

          {/* Result feedback */}
          <div className={`overflow-hidden transition-all duration-300 ${answered && lastResult ? 'mt-5 max-h-10' : 'max-h-0'}`}>
            {answered && lastResult && (
              <p className={`font-bold text-base ${lastResult.correct ? 'text-green-400' : 'text-red-400'}`}>
                {lastResult.correct
                  ? `✅ +${lastResult.points} pts`
                  : `❌ Answer was ${lastResult.correctAnswer}`}
              </p>
            )}
          </div>
        </div>

        {/* Typed input */}
        {answerMode === 'typed' && (
          <QuestionCard
            sequence={currentQ + 1}
            total={questions.length}
            questionText={q.question_text}
            onAnswer={handleAnswer}
            disabled={answered}
            lastResult={lastResult}
            pendingAnswer={pendingAnswer}
            correctAnswer={lastResult && !lastResult.correct ? lastResult.correctAnswer ?? null : null}
            showProgress={false}
            hideQuestion={true}
            hideInput={false}
          />
        )}

        {/* Multiple choice buttons */}
        {answerMode === 'multiple_choice' && mcOptions.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {mcOptions.map((option, i) => {
              const isSelected = mcSelected === option
              const isPending  = isSelected && answered && lastResult === null
              const isCorrect  = answered && lastResult?.correct === true  && isSelected
              const isWrong    = answered && lastResult?.correct === false && isSelected
              const wasCorrect = answered && lastResult?.correct === false &&
                option === lastResult?.correctAnswer

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (answered) return
                    setMcSelected(option)
                    handleAnswer(option)
                  }}
                  disabled={answered}
                  className={`py-5 rounded-2xl text-2xl font-bold transition-all duration-200 border-2 ${
                    isPending  ? 'bg-purple-600/40 border-purple-400 text-white shadow-lg shadow-purple-900/30 scale-[1.02] animate-pulse' :
                    isCorrect  ? 'bg-green-500/30 border-green-400 text-green-100 shadow-lg shadow-green-900/30 scale-[1.02]' :
                    isWrong    ? 'bg-red-500/25 border-red-400/80 text-red-200' :
                    wasCorrect ? 'bg-green-500/15 border-green-400/50 text-green-300' :
                    answered   ? 'bg-white/3 border-white/8 text-white/25' :
                    'bg-white/8 border-white/15 text-white hover:bg-purple-700/40 hover:border-purple-400/60 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        )}

        {answerMode === 'multiple_choice' && !answered && (
          <p className="text-center text-white/20 text-xs pb-4">🔘 Multiple choice · 60% points</p>
        )}

      </div>
    </div>
  )
}