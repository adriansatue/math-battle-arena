'use client'

import { Suspense, use, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Timer }        from '@/components/battle/Timer'
import { QuestionCard } from '@/components/battle/QuestionCard'
import { PackOpener }   from '@/components/cards/PackOpener'
import { GameNotice } from '@/components/battle/GameNotice'
import Link from 'next/link'
import { getPracticeProgress } from '@/lib/game/practice-progress'
import { getResultHoldMs, submitAnswerWithRetry, type AnswerRequestState } from '@/lib/game/answer-submission'

interface Question {
  id:            string
  sequence:      number
  question_text: string
  category:      string
  server_sent_at?: string
}

interface Result {
  correct:        boolean
  points:         number
  correctAnswer?: number
  answerGiven?:   number
  responseMs:     number
}

type ReviewFilter = 'mistakes' | 'all' | 'slowest'

interface PackCard {
  id:          string
  name:        string
  description: string
  rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
  image_url:   string
  generation?: number | null
  grade?:      number
  is_duplicate?: boolean
}

interface Summary {
  total:    number
  correct:  number
  points:   number
  accuracy: number
  avgMs:    number
}

interface ServerPracticeSummary {
  topic: string
  difficulty: string
  source: 'manual' | 'results' | 'profile'
  baseline_attempts: number
  baseline_correct: number
  baseline_avg_ms: number | null
  previous_best_accuracy: number | null
  session_attempts: number
  session_correct: number
  session_avg_ms: number | null
}

type SessionNotice = {
  kind: 'info' | 'warning' | 'error'
  message: string
}

async function readResponseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}))
}

async function fetchBattleQuestions(battleId: string): Promise<Question[]> {
  const response = await fetch(`/api/battles/${battleId}/questions`, { cache: 'no-store' })
  if (!response.ok) return []
  const data = await readResponseJson(response)
  return Array.isArray(data.questions) ? data.questions as Question[] : []
}

type KpiValueFormat = 'percent' | 'seconds' | 'streak' | 'points'

function formatKpiValue(value: number, format: KpiValueFormat) {
  if (format === 'percent') return `${Math.round(value)}%`
  if (format === 'seconds') return `${value.toFixed(1)}s`
  if (format === 'streak') return `${Math.round(value)}x`
  return `+${Math.round(value).toLocaleString()}`
}

function AnimatedKpiValue({ value, format, delayMs }: {
  value: number
  format: KpiValueFormat
  delayMs: number
}) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let animationFrame = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => {
      if (reducedMotion) {
        setDisplayValue(value)
        return
      }

      const startedAt = performance.now()
      const durationMs = 780
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs)
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplayValue(value * eased)
        if (progress < 1) animationFrame = requestAnimationFrame(tick)
      }
      animationFrame = requestAnimationFrame(tick)
    }, delayMs)

    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(animationFrame)
    }
  }, [delayMs, value])

  return <>{formatKpiValue(displayValue, format)}</>
}

export default function PracticeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <PracticeSessionContent params={params} />
    </Suspense>
  )
}

function PracticeSessionContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: battleId } = use(params)
  const router      = useRouter()
  const supabase    = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const answerMode  = (searchParams.get('mode') ?? 'typed') as 'typed' | 'multiple_choice'
  const POINTS_MULTIPLIER = answerMode === 'multiple_choice' ? 0.6 : 1.0

  const [,             setUserId]       = useState('')
  const [battle,       setBattle]       = useState<Record<string, unknown> | null>(null)
  const [questions,    setQuestions]    = useState<Question[]>([])
  const [currentQ,     setCurrentQ]     = useState(0)
  const [answered,     setAnswered]     = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [answerRequestState, setAnswerRequestState] = useState<AnswerRequestState>('idle')
  const [lastResult,   setLastResult]   = useState<Result | null>(null)
  const [serverSentAt, setServerSentAt] = useState<string | null>(null)
  const [score,        setScore]        = useState(0)
  const [streak,       setStreak]       = useState(0)
  const [results,      setResults]      = useState<Result[]>([])
  const [finished,     setFinished]     = useState(false)
  const [summary,      setSummary]      = useState<Summary | null>(null)
  const [serverSummary, setServerSummary] = useState<ServerPracticeSummary | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [mcOptions,    setMcOptions]    = useState<number[]>([])
  const [mcSelected,   setMcSelected]   = useState<number | null>(null)
  const [profilePoints, setProfilePoints] = useState<number | null>(null)
  const [packBalance,   setPackBalance]   = useState<number | null>(null)
  const [opening,       setOpening]       = useState(false)
  const [packCards,     setPackCards]     = useState<PackCard[]>([])
  const [showPack,      setShowPack]      = useState(false)
  const [packError,     setPackError]     = useState<string | null>(null)
  const [showReview,    setShowReview]    = useState(false)
  const [reviewFilter,  setReviewFilter]  = useState<ReviewFilter>('mistakes')
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null)
  const [isGuestUser,   setIsGuestUser]   = useState(false)
  const [linkingSocial, setLinkingSocial] = useState(false)
  const [socialLinkError, setSocialLinkError] = useState<string | null>(null)
  const [showEmailSignup, setShowEmailSignup] = useState(false)
  const [linkingEmail, setLinkingEmail] = useState(false)
  const [emailSignupMessage, setEmailSignupMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [startingMistakePractice, setStartingMistakePractice] = useState(false)
  const timingsRef   = useRef<number[]>([])
  const answeredRef  = useRef(false)   // synchronous guard against timer/click race
  const answerTimeRef = useRef<number | null>(null)
  const mcOptionsCacheRef = useRef(new Map<string, number[]>())
  const mcOptionsRequestsRef = useRef(new Map<string, Promise<number[]>>())

  const loadMcOptions = useCallback((questionId: string): Promise<number[]> => {
    const cached = mcOptionsCacheRef.current.get(questionId)
    if (cached) return Promise.resolve(cached)

    const pending = mcOptionsRequestsRef.current.get(questionId)
    if (pending) return pending

    const request = fetch(`/api/questions/${questionId}/options`)
      .then(async response => {
        if (!response.ok) return []
        const data = await response.json()
        return Array.isArray(data.options) ? data.options as number[] : []
      })
      .then(options => {
        if (options.length > 0) mcOptionsCacheRef.current.set(questionId, options)
        return options
      })
      .catch(() => [])
      .finally(() => mcOptionsRequestsRef.current.delete(questionId))
    mcOptionsRequestsRef.current.set(questionId, request)
    return request
  }, [])

  useEffect(() => {
    if (answerMode !== 'multiple_choice' || !questions[currentQ]) return

    let active = true
    const currentQuestionId = questions[currentQ].id
    loadMcOptions(currentQuestionId).then(options => {
      if (active) setMcOptions(options)
    })

    const nextQuestion = questions[currentQ + 1]
    if (nextQuestion) void loadMcOptions(nextQuestion.id)

    return () => { active = false }
  }, [currentQ, questions, answerMode, loadMcOptions])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setIsGuestUser(Boolean(user.is_anonymous))

      const { data: b } = await supabase
        .from('battles').select('*').eq('id', battleId).single()
      if (!b) { router.push('/practice'); return }
      setBattle(b)

      const qs = await fetchBattleQuestions(battleId)
      if (qs.length === 0) {
        setSessionNotice({
          kind:    'error',
          message: 'Practice questions could not be loaded. Please start a new session.',
        })
        router.push('/practice')
        return
      }

      setQuestions(qs)
      setServerSentAt(new Date().toISOString())
      setLoading(false)
    }
    load()
  }, [battleId, router, supabase])

  const finishSession = useCallback(async (allResults: Result[]) => {
    const correct  = allResults.filter(r => r.correct).length
    const total    = allResults.length
    const pts      = allResults.reduce((s, r) => s + r.points, 0)
    const avgMs    = timingsRef.current.length
      ? Math.round(timingsRef.current.reduce((a, b) => a + b, 0) / timingsRef.current.length)
      : 0

    let nextSummary: Summary = {
      total,
      correct,
      points:   pts,
      accuracy: Math.round((correct / total) * 100),
      avgMs,
    }

    try {
      const response = await fetch(`/api/battles/${battleId}/finish`, { method: 'POST' })
      const data = await readResponseJson(response)

      if (!response.ok) {
        setSessionNotice({
          kind: response.status === 409 ? 'warning' : 'error',
          message: String(data.error ?? 'Practice results could not be fully saved yet.'),
        })
      } else {
        setSessionNotice(null)
        const saved = data.practice_summary as ServerPracticeSummary | null
        if (saved?.session_attempts) {
          setServerSummary(saved)
          nextSummary = {
            total: saved.session_attempts,
            correct: saved.session_correct,
            points: pts,
            accuracy: Math.round((saved.session_correct / saved.session_attempts) * 100),
            avgMs: saved.session_avg_ms ?? 0,
          }
        }
      }
    } catch {
      setSessionNotice({
        kind: 'error',
        message: 'Connection issue while saving your practice results.',
      })
    }

    setSummary(nextSummary)
    setFinished(true)

    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user) {
      const { data: profile } = await sb
        .from('profiles')
        .select('total_points, points_balance')
        .eq('id', user.id)
        .single()
      if (profile) {
        setProfilePoints(profile.total_points)
        setPackBalance(profile.points_balance)
      }
    }
  }, [battleId])

  const handleAnswer = useCallback(async (answer: number, isRetry = false) => {
    if (!questions[currentQ]) return
    if (isRetry) {
      if (!answeredRef.current || pendingAnswer !== answer) return
    } else {
      if (answeredRef.current || answered) return
      answeredRef.current = true
      setAnswered(true)
      setPendingAnswer(answer)
      answerTimeRef.current = serverSentAt
        ? Date.now() - new Date(serverSentAt).getTime()
        : 5000
      timingsRef.current.push(answerTimeRef.current)
    }

    let res: Response
    try {
      res = await submitAnswerWithRetry(`/api/battles/${battleId}/answer`, {
        question_id:   questions[currentQ].id,
        answer_given:  answer,
        time_taken_ms: answerTimeRef.current ?? 5000,
        multiplier:    POINTS_MULTIPLIER,   // server applies this for solo practice battles only
      }, setAnswerRequestState)
    } catch {
      setAnswerRequestState('failed')
      setSessionNotice({ kind: 'error', message: 'Your answer was not marked wrong. Check your connection and retry.' })
      return
    }
    const data = await readResponseJson(res)

    if (!res.ok) {
      setAnswerRequestState('failed')
      setSessionNotice({
        kind:    res.status === 409 ? 'warning' : 'error',
        message: String(data.error ?? 'Your answer could not be saved. Please retry.'),
      })
      return
    }
    setAnswerRequestState('idle')
    setSessionNotice(null)

    const isCorrect = typeof data.is_correct === 'boolean' ? data.is_correct : false
    const pointsEarned = typeof data.points_earned === 'number' ? data.points_earned : 0
    const correctAnswer = typeof data.correct_answer === 'number' ? data.correct_answer : undefined

    const result: Result = {
      correct:       isCorrect,
      points:        pointsEarned,  // server already applied multiplier
      correctAnswer,
      answerGiven:   answer,
      responseMs:    answerTimeRef.current ?? 5000,
    }

    // No client-side scaling needed — server already applied POINTS_MULTIPLIER
    const adjustedResult: Result = result

    setLastResult(adjustedResult)

    if (adjustedResult.correct) {
      setScore(prev => prev + adjustedResult.points)
      setStreak(prev => prev + 1)
      setResults(prev => [...prev, adjustedResult])
    } else {
      setStreak(0)
      setResults(prev => [...prev, adjustedResult])
    }

    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        const nextQuestion = questions[currentQ + 1]
        setMcOptions(nextQuestion ? mcOptionsCacheRef.current.get(nextQuestion.id) ?? [] : [])
        setCurrentQ(prev => prev + 1)
        setAnswered(false)
        answeredRef.current = false
        setPendingAnswer(null)
        setAnswerRequestState('idle')
        setLastResult(null)
        setMcSelected(null)
        setServerSentAt(new Date().toISOString())
      } else {
        finishSession([...results, adjustedResult])
      }
    }, getResultHoldMs(adjustedResult.correct))
  }, [answered, pendingAnswer, questions, currentQ, serverSentAt, battleId, results, finishSession, POINTS_MULTIPLIER])

  useEffect(() => {
    if (answerMode !== 'multiple_choice' || answered || mcOptions.length === 0) return

    function handleChoiceShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return
      if (!/^[1-4]$/.test(event.key)) return

      const option = mcOptions[Number(event.key) - 1]
      if (option === undefined) return
      event.preventDefault()
      setMcSelected(option)
      void handleAnswer(option)
    }

    window.addEventListener('keydown', handleChoiceShortcut)
    return () => window.removeEventListener('keydown', handleChoiceShortcut)
  }, [answerMode, answered, mcOptions, handleAnswer])

  async function handleTimerExpire() {
    if (answeredRef.current || answered || !questions[currentQ]) return
    answeredRef.current = true
    setAnswered(true)
    setPendingAnswer(null)

    const timeTakenMs = serverSentAt
      ? Math.max(0, Date.now() - new Date(serverSentAt).getTime())
      : (battle?.time_per_q_secs as number ?? 15) * 1000
    timingsRef.current.push(timeTakenMs)

    const res = await fetch(`/api/battles/${battleId}/answer`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        question_id:   questions[currentQ].id,
        answer_given:  null,
        time_taken_ms: timeTakenMs,
        timed_out:     true,
        multiplier:    POINTS_MULTIPLIER,
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}

    if (!res) {
      setSessionNotice({
        kind:    'error',
        message: 'Connection issue while saving the timeout. Moving on.',
      })
    } else if (!res.ok) {
      setSessionNotice({
        kind:    res.status === 409 ? 'warning' : 'error',
        message: String(data.error ?? 'The timeout could not be saved. Moving on.'),
      })
    } else {
      setSessionNotice(null)
    }

    const result: Result = {
      correct:       false,
      points:        0,
      correctAnswer: data.correct_answer,
      responseMs:    timeTakenMs,
    }
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
    }).catch(() => null)

    if (!res) {
      setPackError('Connection issue. Try opening the pack again.')
      setOpening(false)
      return
    }

    const data = await readResponseJson(res)
    if (!res.ok) { setPackError(String(data.error ?? 'Could not open this pack.')); setOpening(false); return }
    const costs = { basic: 300, rare: 900, legendary: 1800 }
    setPackCards(Array.isArray(data.cards) ? data.cards as PackCard[] : [])
    setPackBalance(prev => typeof data.points_balance === 'number'
      ? data.points_balance
      : prev !== null ? prev - costs[packType] : null)
    setShowPack(true)
    setOpening(false)
  }

  async function linkGuestWithGoogle() {
    setLinkingSocial(true)
    setSocialLinkError(null)

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options:  {
        redirectTo: `${window.location.origin}/auth/callback?next=/practice/${battleId}`,
      },
    })

    if (error) {
      setSocialLinkError(error.message)
      setLinkingSocial(false)
      return
    }

    if (data?.url) {
      window.location.href = data.url
      return
    }

    setSocialLinkError('Could not start Google sign-up. Please try again.')
    setLinkingSocial(false)
  }

  async function linkGuestWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLinkingEmail(true)
    setEmailSignupMessage(null)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const next = `/practice/${battleId}?mode=${answerMode}`
    const callback = new URL('/auth/callback', window.location.origin)
    callback.searchParams.set('next', next)
    callback.searchParams.set('upgrade', 'email')

    const { data, error } = await supabase.auth.updateUser(
      { email, password },
      { emailRedirectTo: callback.toString() }
    )

    if (error) {
      setEmailSignupMessage({ kind: 'error', text: error.message })
      setLinkingEmail(false)
      return
    }

    if (data.user && !data.user.is_anonymous) {
      setIsGuestUser(false)
      setSessionNotice({ kind: 'info', message: 'Account saved. Your points and progress are secure.' })
    } else {
      setEmailSignupMessage({ kind: 'success', text: 'Check your email to confirm and secure this account.' })
    }
    setLinkingEmail(false)
  }

  async function startMistakePractice() {
    const missedCount = results.filter(result => !result.correct).length
    const missedTopic = serverSummary?.topic ?? questions.find((_, index) => !results[index]?.correct)?.category
    const difficulty = serverSummary?.difficulty ?? battle?.difficulty
    if (!missedTopic || typeof difficulty !== 'string' || missedCount === 0) return

    setStartingMistakePractice(true)
    setSessionNotice(null)
    const response = await fetch('/api/practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: missedTopic,
        difficulty,
        question_count: Math.min(30, Math.max(5, missedCount)),
        source: 'results',
      }),
    }).catch(() => null)
    const data = response ? await readResponseJson(response) : {}

    if (!response?.ok || typeof data.session_id !== 'string') {
      setSessionNotice({
        kind: 'error',
        message: String(data.error ?? 'Could not start mistake practice. Please try again.'),
      })
      setStartingMistakePractice(false)
      return
    }

    router.push(`/practice/${data.session_id}?mode=${answerMode}`)
  }

  // ── SUMMARY SCREEN ──────────────────────────────
  if (finished && summary) {
    const missedCount = results.filter(result => !result.correct).length
    const maxStreak = results.reduce((best, result) => {
      const next = result.correct ? best.current + 1 : 0
      return { current: next, max: Math.max(best.max, next) }
    }, { current: 0, max: 0 }).max
    const currentDifficulty = serverSummary?.difficulty ?? String(battle?.difficulty ?? 'medium')
    const nextDifficulty = currentDifficulty === 'easy' ? 'medium' : 'hard'
    const practiceHref = serverSummary
      ? `/practice?topic=${serverSummary.topic}&difficulty=${serverSummary.difficulty}&source=${serverSummary.source}`
      : '/practice'
    const harderHref = serverSummary
      ? `/practice?topic=${serverSummary.topic}&difficulty=${nextDifficulty}&source=results`
      : '/practice'
    const reviewEntries = questions.flatMap((question, index) => {
      const result = results[index]
      return result ? [{ question, result, index }] : []
    })
    const visibleReviewEntries = reviewFilter === 'mistakes'
      ? reviewEntries.filter(entry => !entry.result.correct)
      : reviewFilter === 'slowest'
        ? [...reviewEntries].sort((a, b) => b.result.responseMs - a.result.responseMs).slice(0, 5)
        : reviewEntries
    const progress = serverSummary ? getPracticeProgress({
      baselineAttempts: serverSummary.baseline_attempts,
      baselineCorrect: serverSummary.baseline_correct,
      baselineAvgMs: serverSummary.baseline_avg_ms,
      sessionAttempts: serverSummary.session_attempts,
      sessionCorrect: serverSummary.session_correct,
      sessionAvgMs: serverSummary.session_avg_ms,
      previousBestAccuracy: serverSummary.previous_best_accuracy,
    }) : null
    const topicLabel = (serverSummary?.topic ?? questions[0]?.category ?? 'this topic').replaceAll('_', ' ')
    const accuracyDelta = progress?.accuracyChange ?? null
    const speedDeltaMs = progress?.speedChangeMs ?? null
    const progressHeadline = progress?.isPersonalBest ? 'New personal best' :
      progress?.status === 'improved' && accuracyDelta !== null && accuracyDelta > 0 ? `Accuracy up ${accuracyDelta} points` :
      progress?.status === 'improved' && speedDeltaMs !== null && speedDeltaMs < 0 ? `${(Math.abs(speedDeltaMs) / 1000).toFixed(1)}s faster per answer` :
      progress?.status === 'stable' ? 'Consistent performance' :
      progress?.status === 'keep_practising' ? 'Accuracy needs another round' :
      'Your baseline is ready'
    const PACKS = [
      { id: 'basic',     label: 'Basic',     emoji: '📦', cost: 300,  color: 'from-slate-400 to-slate-500',   glow: 'shadow-slate-400/20' },
      { id: 'rare',      label: 'Rare',      emoji: '💎', cost: 900,  color: 'from-blue-400 to-cyan-500',     glow: 'shadow-blue-400/20'  },
      { id: 'legendary', label: 'Legendary', emoji: '👑', cost: 1800, color: 'from-yellow-400 to-amber-500',  glow: 'shadow-yellow-400/20' },
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

          {/* Result headline */}
          <div className="mb-5 text-center">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/40">Practice complete</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-6xl font-black tabular-nums text-white">{summary.correct}</span>
              <span className="text-2xl font-black text-white/30">/{summary.total}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-purple-200">{perfLabel}</p>
          </div>

          {sessionNotice && (
            <div className="mb-4">
              <GameNotice kind={sessionNotice.kind}>{sessionNotice.message}</GameNotice>
            </div>
          )}

          {/* Stats grid */}
          <div className="practice-kpi-grid relative mb-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <span className="practice-kpi-spark practice-kpi-spark-1" aria-hidden="true">✦</span>
            <span className="practice-kpi-spark practice-kpi-spark-2" aria-hidden="true">✦</span>
            <span className="practice-kpi-spark practice-kpi-spark-3" aria-hidden="true">✦</span>
            <span className="practice-kpi-spark practice-kpi-spark-4" aria-hidden="true">✦</span>
            {[
              { label: 'Accuracy', value: summary.accuracy, format: 'percent' as const, accent: 'bg-emerald-400', valueColor: 'text-emerald-200' },
              { label: 'Avg speed', value: summary.avgMs / 1000, format: 'seconds' as const, accent: 'bg-cyan-400', valueColor: 'text-cyan-200' },
              { label: 'Best streak', value: maxStreak, format: 'streak' as const, accent: 'bg-orange-400', valueColor: 'text-orange-200' },
              { label: 'Points', value: summary.points, format: 'points' as const, accent: 'bg-amber-300', valueColor: 'text-amber-200' },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="practice-kpi relative overflow-hidden border-r border-white/10 px-2 py-3 text-center last:border-r-0"
                style={{ animationDelay: `${100 + index * 90}ms` }}
              >
                <span className={`absolute inset-x-0 top-0 h-0.5 ${stat.accent}`} aria-hidden="true" />
                <span
                  className="practice-kpi-sheen absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-18deg] bg-white/10"
                  style={{ animationDelay: `${260 + index * 90}ms` }}
                  aria-hidden="true"
                />
                <div
                  className={`practice-kpi-value text-base font-black tabular-nums sm:text-lg ${stat.valueColor}`}
                  style={{ animationDelay: `${180 + index * 90}ms` }}
                >
                  <AnimatedKpiValue value={stat.value} format={stat.format} delayMs={180 + index * 90} />
                </div>
                <div className="mt-1 text-[9px] font-bold uppercase text-white/35">{stat.label}</div>
              </div>
            ))}
          </div>

          {isGuestUser && (
            <div className="mb-4 bg-white/[0.04] border border-white/10 rounded-2xl p-4">
              <p className="text-white font-bold text-sm text-center">Save your points and XP</p>
              <p className="text-white/45 text-xs text-center mt-1 mb-3">
                Link Google to this guest profile so you keep today&apos;s progress.
              </p>
              <button
                onClick={linkGuestWithGoogle}
                disabled={linkingSocial}
                className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed font-semibold py-3 rounded-xl text-sm transition shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                {linkingSocial ? 'Opening Google...' : 'Save with Google'}
              </button>
              <div className="my-3 flex items-center gap-3 text-[10px] font-bold uppercase text-white/25">
                <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEmailSignup(value => !value)
                  setEmailSignupMessage(null)
                }}
                aria-expanded={showEmailSignup}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                {showEmailSignup ? 'Hide email sign up' : 'Sign up with email'}
              </button>
              {showEmailSignup && (
                <form onSubmit={linkGuestWithEmail} className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <p className="text-xs leading-5 text-white/45">This keeps your current profile, points, and rewards.</p>
                  <label className="block">
                    <span className="sr-only">Email</span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="Email address"
                      className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-purple-300 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Password</span>
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Password · 8 characters minimum"
                      className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-purple-300 focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={linkingEmail}
                    className="w-full rounded-xl bg-purple-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-purple-200 disabled:cursor-wait disabled:opacity-60"
                  >
                    {linkingEmail ? 'Saving account...' : 'Create email account'}
                  </button>
                  {emailSignupMessage && (
                    <p role={emailSignupMessage.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${
                      emailSignupMessage.kind === 'error' ? 'text-red-300' : 'text-green-300'
                    }`}>
                      {emailSignupMessage.text}
                    </p>
                  )}
                </form>
              )}
              {socialLinkError && (
                <p className="text-red-400 text-xs text-center mt-2">{socialLinkError}</p>
              )}
            </div>
          )}

          {/* Recommended next action */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-cyan-300/25 bg-cyan-300/10">
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200/60">Your next challenge</p>
                {missedCount === 0 && currentDifficulty !== 'hard' && (
                  <span className="rounded-full bg-cyan-300 px-2 py-1 text-[9px] font-black uppercase text-slate-950">Unlocked</span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-black text-white">
              {missedCount === 0 && currentDifficulty !== 'hard' ? `Ready for ${nextDifficulty} mode` :
               missedCount <= 3 ? 'Turn mistakes into a clean run' :
               'Build consistency with another set'}
              </h2>
              <p className="mt-1 text-xs leading-5 text-white/55">
              {missedCount === 0 && currentDifficulty !== 'hard' ? `You cleared ${topicLabel} with perfect accuracy. Take the same skill into harder questions.` :
               missedCount <= 3 ? `${missedCount} missed ${missedCount === 1 ? 'answer' : 'answers'} will become a focused set of new questions.` :
               `Repeat ${currentDifficulty} difficulty before moving up.`}
              </p>
              {missedCount === 0 && currentDifficulty !== 'hard' && (
                <div className="mt-3 flex items-center gap-2 text-xs font-black capitalize">
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/50">{currentDifficulty}</span>
                  <span className="text-cyan-200/50">→</span>
                  <span className="rounded-lg bg-cyan-300/15 px-2.5 py-1.5 text-cyan-100">{nextDifficulty}</span>
                </div>
              )}
            </div>
            {missedCount === 0 && currentDifficulty !== 'hard' ? (
              <Link href={harderHref} className="block w-full border-t border-cyan-200/15 bg-cyan-300 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-200">
                Start {nextDifficulty} practice
              </Link>
            ) : missedCount > 0 && missedCount <= 3 ? (
              <button
                type="button"
                onClick={startMistakePractice}
                disabled={startingMistakePractice}
                className="w-full border-t border-cyan-200/15 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              >
                {startingMistakePractice ? 'Preparing focused practice...' : `Practice ${Math.max(5, missedCount)} new questions`}
              </button>
            ) : (
              <Link href={practiceHref} className="block w-full border-t border-cyan-200/15 bg-cyan-300 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-200">
                Repeat this level
              </Link>
            )}
          </div>

          {progress && (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Progress vs recent practice</p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    {progressHeadline}
                  </h2>
                </div>
                {progress.isPersonalBest && (
                  <span className="bg-amber-300 px-2 py-1 text-xs font-black text-black">Personal best</span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                  <p className="text-[10px] font-bold uppercase text-white/35">Accuracy</p>
                  <p className={`mt-1 text-xl font-black tabular-nums ${accuracyDelta !== null && accuracyDelta > 0 ? 'text-green-300' : 'text-white'}`}>
                    {accuracyDelta === null ? `${progress.accuracyAfter}%` : `${accuracyDelta > 0 ? '+' : ''}${accuracyDelta} pts`}
                  </p>
                  <p className="mt-1 text-[10px] text-white/35">
                    {progress.accuracyBefore === null ? 'Baseline set' : `${progress.accuracyBefore}% to ${progress.accuracyAfter}%`}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                  <p className="text-[10px] font-bold uppercase text-white/35">Average speed</p>
                  <p className={`mt-1 text-xl font-black tabular-nums ${speedDeltaMs !== null && speedDeltaMs < 0 ? 'text-green-300' : 'text-white'}`}>
                    {speedDeltaMs === null ? (progress.speedAfterMs === null ? '-' : `${(progress.speedAfterMs / 1000).toFixed(1)}s`) :
                     speedDeltaMs < 0 ? `${(Math.abs(speedDeltaMs) / 1000).toFixed(1)}s faster` :
                     speedDeltaMs > 0 ? `${(speedDeltaMs / 1000).toFixed(1)}s slower` : 'No change'}
                  </p>
                  <p className="mt-1 text-[10px] text-white/35">
                    {progress.speedBeforeMs === null || progress.speedAfterMs === null
                      ? 'Baseline set'
                      : `${(progress.speedBeforeMs / 1000).toFixed(1)}s to ${(progress.speedAfterMs / 1000).toFixed(1)}s`}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/45">
                {progress.evidence === 'comparable'
                  ? `Compared with your latest ${serverSummary?.baseline_attempts} unflagged answers in ${serverSummary?.topic.replaceAll('_', ' ')}.`
                  : 'This is an early signal. Complete another set before treating the change as a reliable trend.'}
              </p>
            </div>
          )}

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
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Packs you can open</p>
              <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-2.5 py-1">
                <span className="text-yellow-400 text-xs">💰</span>
                {packBalance !== null ? (
                  <span className="text-yellow-300 font-black text-sm">{packBalance.toLocaleString()} <span className="text-yellow-400/60 font-bold text-xs">pts</span></span>
                ) : (
                  <span className="text-yellow-400/40 text-sm animate-pulse">...</span>
                )}
              </div>
            </div>
            {packError && (
              <p className="text-red-400 text-xs mb-3 text-center">{packError}</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {PACKS.map(pack => {
                const canAfford  = packBalance !== null ? Math.floor(packBalance / pack.cost) : null
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
                      disabled={!affordable || opening || packBalance === null}
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

          {/* Per-question review */}
          <div className="mb-6">
            {/* Compact dot row */}
            <div className="flex gap-1 justify-center flex-wrap mb-3">
              {results.map((r, i) => (
                <div key={i} className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold ${
                  r.correct ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'
                }`}>
                  {r.correct ? '✔' : '✗'}
                </div>
              ))}
            </div>
            {/* Expandable detail */}
            <button
              onClick={() => {
                if (!showReview && missedCount === 0) setReviewFilter('all')
                setShowReview(value => !value)
              }}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-white/60 hover:text-white hover:bg-white/[0.07] transition text-sm font-semibold"
            >
              <span>📝 Review my answers</span>
              <span className="text-xs">{showReview ? '▲ Hide' : '▼ Show'}</span>
            </button>
            {showReview && (
              <div className="mt-2">
                <div className="mb-2 grid grid-cols-3 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="group" aria-label="Answer review filter">
                  {([
                    { id: 'mistakes', label: `Mistakes (${missedCount})` },
                    { id: 'all', label: `All (${results.length})` },
                    { id: 'slowest', label: 'Slowest' },
                  ] as const).map(filter => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setReviewFilter(filter.id)}
                      disabled={filter.id === 'mistakes' && missedCount === 0}
                      aria-pressed={reviewFilter === filter.id}
                      className={`rounded-lg px-2 py-2 text-[11px] font-black transition disabled:opacity-30 ${
                        reviewFilter === filter.id ? 'bg-white text-slate-950' : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                {visibleReviewEntries.map(({ question: q, result: r, index: i }) => {
                  return (
                    <div key={i} className={`rounded-xl px-4 py-3 flex items-start gap-3 border ${
                      r.correct ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
                    }`}>
                      <span className="text-lg shrink-0">{r.correct ? '✅' : '❌'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-white font-semibold text-sm">{q.question_text} = ?</p>
                          <span className="shrink-0 text-[10px] font-bold tabular-nums text-white/35">
                            {(r.responseMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                        {r.correct ? (
                          <p className="text-green-300 text-xs mt-0.5">
                            Your answer: <strong>{r.answerGiven}</strong> · +{r.points} pts
                          </p>
                        ) : r.answerGiven != null ? (
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-red-400/10 px-2.5 py-2 text-red-200">
                              <span className="block text-[10px] uppercase text-red-300/60">Your answer</span>
                              <strong className="text-base">{r.answerGiven}</strong>
                            </div>
                            <div className="rounded-lg bg-green-400/10 px-2.5 py-2 text-green-200">
                              <span className="block text-[10px] uppercase text-green-300/60">Correct answer</span>
                              <strong className="text-base">{r.correctAnswer ?? '-'}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-orange-400/10 px-2.5 py-2 text-xs text-orange-200">
                            <span>Time ran out</span>
                            <span>Correct: <strong className="text-white">{r.correctAnswer ?? '-'}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Link href={practiceHref}
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
        <div className="relative text-right min-w-[72px]">
          {lastResult?.correct && (
            <span
              key={`${currentQ}-${lastResult.points}`}
              className="absolute -top-5 right-0 text-xs font-black text-green-300 motion-safe:animate-bounce"
              aria-hidden="true"
            >
              +{lastResult.points}
            </span>
          )}
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
      {sessionNotice && (
        <div className="w-full max-w-lg mx-auto px-4 mb-4">
          <GameNotice kind={sessionNotice.kind}>{sessionNotice.message}</GameNotice>
        </div>
      )}

      <div className="flex-1 w-full max-w-lg mx-auto px-4 flex flex-col gap-4">

        {/* Timer row: streak · timer · question count */}
        <div className="flex items-center justify-between">
          <div className="w-16">
            {streak >= 2 && (
              <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/30 rounded-xl px-2.5 py-1.5">
                <span className="text-base">🔥</span>
                <span className="text-orange-300 text-xs font-bold tabular-nums">{streak}x</span>
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
            {currentQ === questions.length - 1 ? (
              <span className="text-amber-300 text-[10px] font-black uppercase">Final</span>
            ) : (
              <span className="text-white/30 text-xs">{currentQ + 1}<span className="text-white/15">/{questions.length}</span></span>
            )}
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
                  : pendingAnswer != null
                    ? `Your answer: ${pendingAnswer} · Correct: ${lastResult.correctAnswer}`
                    : `Time ran out · Correct: ${lastResult.correctAnswer}`}
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
            requestState={answerRequestState}
            onRetry={pendingAnswer == null ? undefined : () => handleAnswer(pendingAnswer, true)}
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
                  aria-label={`Answer ${option}, shortcut ${i + 1}`}
                  aria-keyshortcuts={`${i + 1}`}
                  className={`relative py-5 rounded-2xl text-2xl font-bold transition-all duration-200 border-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 ${
                    isPending  ? 'bg-purple-600/40 border-purple-400 text-white shadow-lg shadow-purple-900/30 scale-[1.02] animate-pulse' :
                    isCorrect  ? 'bg-green-500/30 border-green-400 text-green-100 shadow-lg shadow-green-900/30 scale-[1.02]' :
                    isWrong    ? 'bg-red-500/25 border-red-400/80 text-red-200' :
                    wasCorrect ? 'bg-green-500/15 border-green-400/50 text-green-300' :
                    answered   ? 'bg-white/3 border-white/8 text-white/25' :
                    'bg-white/8 border-white/15 text-white hover:bg-purple-700/40 hover:border-purple-400/60 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  <span className="absolute left-3 top-3 text-[10px] font-black text-white/35" aria-hidden="true">{i + 1}</span>
                  {option}
                </button>
              )
            })}
          </div>
        )}

        {answerMode === 'multiple_choice' && mcOptions.length === 0 && !answered && (
          <div className="grid grid-cols-2 gap-3" aria-label="Loading answer choices">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[72px] rounded-2xl border-2 border-white/8 bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {answerMode === 'multiple_choice' && !answered && (
          <p className="text-center text-white/20 text-xs pb-4">🔘 Multiple choice · 60% points</p>
        )}

        {answerMode === 'multiple_choice' && pendingAnswer != null && !lastResult && (
          <div className="text-center text-sm font-bold" role="status" aria-live="polite">
            {answerRequestState === 'failed' ? (
              <div className="flex items-center justify-center gap-3 text-red-200">
                <span>We could not save your answer.</span>
                <button
                  type="button"
                  onClick={() => handleAnswer(pendingAnswer, true)}
                  className="rounded-lg border border-red-300/40 px-3 py-1.5 hover:bg-red-500/15"
                >
                  Retry
                </button>
              </div>
            ) : answerRequestState === 'slow' ? (
              <span className="text-yellow-200">Connection is taking longer than usual...</span>
            ) : answerRequestState === 'retrying' ? (
              <span className="text-yellow-200">Reconnecting...</span>
            ) : answerRequestState === 'checking' ? (
              <span className="text-yellow-200">Checking {pendingAnswer}...</span>
            ) : (
              <span className="text-white/55">Answer locked in</span>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
