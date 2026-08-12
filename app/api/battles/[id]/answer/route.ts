import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePoints, isFlagged, DIFFICULTY_BASE_POINTS } from '@/lib/game/scoring'
import type { Difficulty } from '@/lib/game/questions'
import { isUniqueViolation } from '@/lib/supabase/errors'

const NEXT_Q_OFFSET_MS = 1500
const GRACE_MS = 600

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestArrivalMs = Date.now()

  const { id } = await params
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { question_id, answer_given, time_taken_ms, multiplier, timed_out } = body
  const isTimeout = timed_out === true

  if (typeof question_id !== 'string' || question_id.length === 0) {
    return NextResponse.json({ error: 'question_id is required' }, { status: 400 })
  }

  if (!isTimeout && (typeof answer_given !== 'number' || !isFinite(answer_given) || isNaN(answer_given))) {
    return NextResponse.json({ error: 'Invalid answer format' }, { status: 400 })
  }

  if (typeof time_taken_ms !== 'number' || !isFinite(time_taken_ms) || isNaN(time_taken_ms) || time_taken_ms < 0) {
    return NextResponse.json({ error: 'Invalid timing format' }, { status: 400 })
  }

  const [questionResult, battleResult] = await Promise.all([
    adminSupabase
      .from('battle_questions')
      .select('*')
      .eq('id', question_id)
      .eq('battle_id', id)
      .single(),
    adminSupabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single(),
  ])

  const { data: question, error: qError } = questionResult
  if (qError || !question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const { data: battle } = battleResult
  if (!battle) {
    return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  }

  const isParticipant = battle.host_id === user.id || battle.guest_id === user.id
  if (!isParticipant) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  if (battle.status !== 'active') {
    return NextResponse.json({ error: 'Battle is not active' }, { status: 400 })
  }

  const [existingResult, prevAnswersResult] = await Promise.all([
    adminSupabase
      .from('battle_answers')
      .select('id')
      .eq('question_id', question_id)
      .eq('player_id', user.id)
      .single(),
    adminSupabase
      .from('battle_answers')
      .select('is_correct, answered_at')
      .eq('battle_id', id)
      .eq('player_id', user.id)
      .order('answered_at', { ascending: false })
      .limit(10),
  ])

  const { data: existing } = existingResult
  if (existing) {
    return NextResponse.json({ error: 'Already answered' }, { status: 400 })
  }

  const { data: prevAnswers } = prevAnswersResult
  if (question.sequence > 1 && !prevAnswers?.[0]?.answered_at) {
    return NextResponse.json({ error: 'Previous question is not answered yet' }, { status: 409 })
  }

  const timeLimitMs = battle.time_per_q_secs * 1000
  const firstQuestionStart = battle.started_at
    ? new Date(battle.started_at).getTime()
    : question.server_sent_at
    ? new Date(question.server_sent_at).getTime()
    : null

  const previousQuestionStart = prevAnswers?.[0]?.answered_at
    ? new Date(prevAnswers[0].answered_at).getTime() + NEXT_Q_OFFSET_MS
    : null

  const serverSentAt = question.sequence > 1 ? previousQuestionStart : firstQuestionStart
  const rawServerMs = serverSentAt !== null ? requestArrivalMs - serverSentAt : null

  // Shared question timestamps are not reliable for PvP because players move at
  // different speeds. Use per-player previous-answer timing when possible and
  // fall back to the client timing if the server timestamp is stale or in future.
  const isFreshTimestamp = rawServerMs !== null && rawServerMs >= 0 && rawServerMs <= timeLimitMs + 30_000
  const serverValidatedMs =
    isFreshTimestamp && rawServerMs! <= time_taken_ms + timeLimitMs
      ? rawServerMs!
      : time_taken_ms

  const isOverTime = serverValidatedMs > timeLimitMs + GRACE_MS
  const isCorrect = !isTimeout && Math.abs(Number(answer_given) - Number(question.correct_answer)) < 0.01

  let isFirstAnswer = false
  if (isCorrect && battle.mode === 'realtime') {
    const { data: claimed } = await adminSupabase
      .from('battle_questions')
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', question_id)
      .is('claimed_by', null)
      .select('claimed_by')
      .single()

    isFirstAnswer = claimed?.claimed_by === user.id
  }

  let currentStreak = 0
  for (const answer of (prevAnswers || [])) {
    if (answer.is_correct) currentStreak++
    else break
  }

  const baseOnlyPoints = isCorrect ? DIFFICULTY_BASE_POINTS[battle.difficulty as Difficulty] : 0
  const rawPoints = isTimeout ? 0 : isOverTime ? baseOnlyPoints : calculatePoints({
    difficulty:    battle.difficulty as Difficulty,
    isCorrect,
    timeTakenMs:   serverValidatedMs,
    timeLimitSecs: battle.time_per_q_secs,
    isFirstAnswer,
    currentStreak,
  })

  const isPractice = !battle.guest_id
  const safeMultiplier =
    isPractice &&
    typeof multiplier === 'number' &&
    isFinite(multiplier) &&
    !isNaN(multiplier) &&
    multiplier > 0 &&
    multiplier <= 1
      ? multiplier
      : 1.0
  const pointsEarned = Math.round(rawPoints * safeMultiplier)
  const flagged = isTimeout ? false : isFlagged(time_taken_ms, serverValidatedMs, battle.time_per_q_secs)

  const { error: insertError } = await adminSupabase
    .from('battle_answers')
    .insert({
      battle_id:           id,
      question_id,
      player_id:           user.id,
      answer_given:        isTimeout ? 0 : Number(answer_given),
      is_correct:          isCorrect,
      time_taken_ms,
      server_validated_ms: serverValidatedMs,
      points_earned:       pointsEarned,
      flagged,
    })

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      return NextResponse.json({ error: 'Already answered' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    is_correct:      isCorrect,
    points_earned:   pointsEarned,
    correct_answer:  isCorrect ? null : question.correct_answer,
    is_first_answer: isFirstAnswer,
    current_streak:  isCorrect ? currentStreak + 1 : 0,
    flagged,
  })
}
