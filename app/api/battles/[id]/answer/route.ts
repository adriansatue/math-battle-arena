import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePoints, isFlagged, BASE_POINTS, DIFFICULTY_MULTIPLIER } from '@/lib/game/scoring'
import type { Difficulty } from '@/lib/game/questions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Capture arrival time before any async work so DB query latency
  // doesn't inflate serverValidatedMs and cause false "over-time" results.
  const requestArrivalMs = Date.now()

  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { question_id, answer_given, time_taken_ms, multiplier } = body

  // Validate answer_given — must be a finite number
  if (typeof answer_given !== 'number' || !isFinite(answer_given) || isNaN(answer_given)) {
    return NextResponse.json({ error: 'Invalid answer format' }, { status: 400 })
  }

  // Fetch question with correct_answer (server only)
  const { data: question, error: qError } = await supabase
    .from('battle_questions')
    .select('*')
    .eq('id', question_id)
    .eq('battle_id', id)
    .single()

  if (qError || !question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Fetch battle for time limit + difficulty
  const { data: battle } = await supabase
    .from('battles')
    .select('*')
    .eq('id', id)
    .single()

  if (!battle) {
    return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  }

  const timeLimitMs = battle.time_per_q_secs * 1000

  // Use per-question server_sent_at if it was updated when the question started;
  // otherwise fall back to client-supplied time_taken_ms.
  // We NEVER return 400 for slow answers — just award 0 pts so the game keeps moving.
  const serverSentAt = question.server_sent_at
    ? new Date(question.server_sent_at).getTime()
    : null

  // Compute raw server-side elapsed time
  const rawServerMs = serverSentAt ? requestArrivalMs - serverSentAt : null

  // A timestamp is "fresh" only if it was set recently (within 1 question period + 30s buffer).
  const isFreshTimestamp = rawServerMs !== null && rawServerMs <= timeLimitMs + 30_000

  // If the server clock is fresh BUT shows a time more than a full question period above what
  // the client reports, the timestamp is stale — this happens when the previous question timed
  // out without submitting an answer (timer expiry doesn't call the API, so server_sent_at for
  // the next question is never refreshed). In that case fall back to client-supplied time.
  const serverValidatedMs =
    isFreshTimestamp && rawServerMs! <= time_taken_ms + timeLimitMs
      ? rawServerMs!
      : time_taken_ms

  // Mark the answer as over-time but still process it (gives 0 pts via calculatePoints)
  // A 600ms grace period absorbs click-latency and the timer/answer race condition
  // where handleTimerExpire and handleAnswer fire in the same JS tick.
  const GRACE_MS = 600
  const isOverTime = serverValidatedMs > timeLimitMs + GRACE_MS

  // Check if already answered by this player
  const { data: existing } = await supabase
    .from('battle_answers')
    .select('id')
    .eq('question_id', question_id)
    .eq('player_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already answered' }, { status: 400 })
  }

  // Check correctness (allow small float tolerance for fractions)
  const isCorrect = Math.abs(Number(answer_given) - Number(question.correct_answer)) < 0.01

  // Atomic claimed_by update for first-answer bonus (realtime mode)
  let isFirstAnswer = false
  if (isCorrect && battle.mode === 'realtime') {
    const { data: claimed } = await supabase
      .from('battle_questions')
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', question_id)
      .is('claimed_by', null)
      .select('claimed_by')
      .single()

    isFirstAnswer = claimed?.claimed_by === user.id
  }

  // Get current streak for this player in this battle
  const { data: prevAnswers } = await supabase
    .from('battle_answers')
    .select('is_correct')
    .eq('battle_id', id)
    .eq('player_id', user.id)
    .order('answered_at', { ascending: false })
    .limit(10)

  let currentStreak = 0
  for (const a of (prevAnswers || [])) {
    if (a.is_correct) currentStreak++
    else break
  }

  // Update this question's server_sent_at so the NEXT question's timing starts fresh.
  // Offset by the client transition delay (1200ms anim + ~300ms network buffer = 1500ms)
  // so the clock for the next question only starts when it's actually visible to the player.
  const NEXT_Q_OFFSET_MS = 1500
  await supabase
    .from('battle_questions')
    .update({ server_sent_at: new Date(requestArrivalMs + NEXT_Q_OFFSET_MS).toISOString() })
    .eq('battle_id', id)
    .gt('sequence', question.sequence)
    .is('claimed_by', null)  // only unstarted questions

  // Calculate points.
  // If overtime but still correct, award base points only (no speed/streak/first bonus).
  // This prevents the confusing "+0 pts" on a correct answer caused by borderline timing.
  const baseOnlyPoints = isCorrect ? Math.round(BASE_POINTS * DIFFICULTY_MULTIPLIER[battle.difficulty as Difficulty]) : 0
  const rawPoints = isOverTime ? baseOnlyPoints : calculatePoints({
    difficulty:    battle.difficulty as Difficulty,
    isCorrect,
    timeTakenMs:   serverValidatedMs,
    timeLimitSecs: battle.time_per_q_secs,
    isFirstAnswer,
    currentStreak,
  })

  // Apply optional multiplier — only honoured for solo (practice) battles where guest_id
  // is null, so the client cannot inflate points in real PvP games.
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

  // Flag suspicious timing
  const flagged = isFlagged(time_taken_ms, serverValidatedMs, battle.time_per_q_secs)

  // Save the answer
  const { error: insertError } = await supabase
    .from('battle_answers')
    .insert({
      battle_id:           id,
      question_id,
      player_id:           user.id,
      answer_given:        Number(answer_given),
      is_correct:          isCorrect,
      time_taken_ms,
      server_validated_ms: serverValidatedMs,
      points_earned:       pointsEarned,
      flagged,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    is_correct:     isCorrect,
    points_earned:  pointsEarned,
    correct_answer: isCorrect ? null : question.correct_answer,
    is_first_answer: isFirstAnswer,
    current_streak: isCorrect ? currentStreak + 1 : 0,
    flagged,
  })
}