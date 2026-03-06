'use client'

import { use, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Timer }        from '@/components/battle/Timer'
import { QuestionCard } from '@/components/battle/QuestionCard'
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

interface Summary {
  total:    number
  correct:  number
  points:   number
  accuracy: number
  avgMs:    number
}

export default function PracticeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: battleId } = use(params)
  const router   = useRouter()
  const supabase = createClient()

  const [userId,       setUserId]       = useState('')
  const [battle,       setBattle]       = useState<Record<string, unknown> | null>(null)
  const [questions,    setQuestions]    = useState<Question[]>([])
  const [currentQ,     setCurrentQ]     = useState(0)
  const [answered,     setAnswered]     = useState(false)
  const [lastResult,   setLastResult]   = useState<Result | null>(null)
  const [serverSentAt, setServerSentAt] = useState<string | null>(null)
  const [score,        setScore]        = useState(0)
  const [streak,       setStreak]       = useState(0)
  const [results,      setResults]      = useState<Result[]>([])
  const [finished,     setFinished]     = useState(false)
  const [summary,      setSummary]      = useState<Summary | null>(null)
  const [loading,      setLoading]      = useState(true)
  const timingsRef = useRef<number[]>([])

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
  }, [battleId])

  const handleAnswer = useCallback(async (answer: number) => {
    if (answered || !questions[currentQ]) return
    setAnswered(true)

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

    setLastResult(result)
    setResults(prev => [...prev, result])

    if (result.correct) {
      setScore(prev => prev + result.points)
      setStreak(prev => prev + 1)
    } else {
      setStreak(0)
    }

    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ(prev => prev + 1)
        setAnswered(false)
        setLastResult(null)
        setServerSentAt(new Date().toISOString())
      } else {
        finishSession([...results, result])
      }
    }, 1200)
  }, [answered, questions, currentQ, serverSentAt, battleId, results, finishSession])

  function handleTimerExpire() {
    if (!answered) {
      setAnswered(true)
      const result: Result = { correct: false, points: 0 }
      setLastResult(result)
      setResults(prev => [...prev, result])
      setStreak(0)
      setTimeout(() => {
        if (currentQ + 1 < questions.length) {
          setCurrentQ(prev => prev + 1)
          setAnswered(false)
          setLastResult(null)
          setServerSentAt(new Date().toISOString())
        } else {
          finishSession([...results, result])
        }
      }, 1000)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse text-xl">Loading practice...</div>
    </div>
  )

  // ── SUMMARY SCREEN ──────────────────────────────
  if (finished && summary) {
    const stars = summary.accuracy >= 90 ? 5 :
                  summary.accuracy >= 75 ? 4 :
                  summary.accuracy >= 60 ? 3 :
                  summary.accuracy >= 40 ? 2 : 1

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">

            <div className="text-6xl mb-4">
              {summary.accuracy >= 80 ? '🏆' : summary.accuracy >= 60 ? '💪' : '📚'}
            </div>

            <h1 className="text-3xl font-bold text-white mb-1">Practice Complete!</h1>
            <p className="text-purple-300 mb-6">
              {summary.accuracy >= 90 ? 'Outstanding!' :
               summary.accuracy >= 75 ? 'Great work!' :
               summary.accuracy >= 60 ? 'Keep it up!' : 'Keep practicing!'}
            </p>

            {/* Stars */}
            <div className="flex justify-center gap-1 mb-6">
              {[1,2,3,4,5].map(i => (
                <span key={i} className={`text-3xl transition-all ${i <= stars ? 'opacity-100' : 'opacity-20'}`}>
                  ⭐
                </span>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'Correct',   value: `${summary.correct}/${summary.total}`, emoji: '✅' },
                { label: 'Accuracy',  value: `${summary.accuracy}%`,                emoji: '🎯' },
                { label: 'Points',    value: summary.points.toLocaleString(),        emoji: '⭐' },
                { label: 'Avg Speed', value: `${(summary.avgMs / 1000).toFixed(1)}s`, emoji: '⚡' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/5 rounded-xl p-3">
                  <div className="text-xl mb-1">{stat.emoji}</div>
                  <div className="text-white font-bold text-lg">{stat.value}</div>
                  <div className="text-purple-300 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Per-question breakdown */}
            <div className="flex gap-1 justify-center mb-6">
              {results.map((r, i) => (
                <div key={i} className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                  r.correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {r.correct ? '✓' : '✗'}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Link href="/practice"
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
                🔄 Practice Again
              </Link>
              <Link href="/lobby"
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 rounded-xl transition text-center">
                ⚔️ Battle!
              </Link>
            </div>

          </div>
        </div>
      </div>
    )
  }

  const q = questions[currentQ]
  if (!q) return null

  // ── PRACTICE SCREEN ─────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/practice" className="text-purple-300 hover:text-white text-sm transition">
            ← Practice
          </Link>
          <div className="text-center">
            <span className="text-purple-300 text-sm capitalize">
              {q.category?.replace('_', ' ')} · {battle?.difficulty as string}
            </span>
          </div>
          <div className="text-right">
            <p className="text-white font-bold">{score} pts</p>
            {streak >= 3 && (
              <p className="text-orange-400 text-xs">🔥 {streak}x streak!</p>
            )}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 justify-center">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${
              i < currentQ     ? 'w-4 bg-purple-500' :
              i === currentQ   ? 'w-4 bg-white' :
                                 'w-2 bg-white/20'
            }`}/>
          ))}
        </div>

        {/* Timer + Question */}
        <div className="flex items-center gap-4">
          <Timer
            durationSecs={battle?.time_per_q_secs as number ?? 15}
            serverSentAt={serverSentAt}
            onExpire={handleTimerExpire}
            paused={answered}
          />
          <div className="flex-1">
            <QuestionCard
              sequence={currentQ + 1}
              total={questions.length}
              questionText={q.question_text}
              onAnswer={handleAnswer}
              disabled={answered}
              lastResult={lastResult}
            />
          </div>
        </div>

        {/* Hint when wrong */}
        {lastResult && !lastResult.correct && lastResult.correctAnswer !== undefined && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-center">
            <p className="text-red-300 text-sm">
              The correct answer was <span className="font-bold text-white">{lastResult.correctAnswer}</span>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}