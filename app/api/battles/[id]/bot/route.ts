import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBotAnswer, getBotDelay, BOT_CONFIGS } from '@/lib/game/bot'
import type { BotDifficulty } from '@/lib/game/bot'
import { calculatePoints } from '@/lib/game/scoring'
import type { Difficulty } from '@/lib/game/questions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminSupabase = createAdminClient()

  const { question_id, bot_difficulty } = await request.json()

  // Fetch question with correct answer
  const { data: question } = await adminSupabase
    .from('battle_questions')
    .select('*')
    .eq('id', question_id)
    .eq('battle_id', id)
    .single()

  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Fetch battle
  const { data: battle } = await adminSupabase
    .from('battles')
    .select('*')
    .eq('id', id)
    .single()

  if (!battle || !battle.bot_id) {
    return NextResponse.json({ error: 'Not a bot battle' }, { status: 400 })
  }

  // Check if bot already answered
  const { data: existing } = await adminSupabase
    .from('battle_answers')
    .select('id')
    .eq('question_id', question_id)
    .eq('player_id', battle.bot_id)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Already answered' })
  }

  const diff      = (bot_difficulty ?? 'medium') as BotDifficulty
  const config    = BOT_CONFIGS[diff]
  const { answer, isCorrect } = getBotAnswer(
    Number(question.correct_answer),
    diff
  )

  const timeTakenMs = getBotDelay(diff)

  // Calculate bot points
  const pointsEarned = calculatePoints({
    difficulty:    battle.difficulty as Difficulty,
    isCorrect,
    timeTakenMs,
    timeLimitSecs: battle.time_per_q_secs,
    isFirstAnswer: false,
    currentStreak: 0,
  })

  // Save bot answer
  await adminSupabase
    .from('battle_answers')
    .insert({
      battle_id:           id,
      question_id,
      player_id:           battle.bot_id,
      answer_given:        answer,
      is_correct:          isCorrect,
      time_taken_ms:       timeTakenMs,
      server_validated_ms: timeTakenMs,
      points_earned:       pointsEarned,
      flagged:             false,
    })

  return NextResponse.json({
    is_correct:    isCorrect,
    answer_given:  answer,
    points_earned: pointsEarned,
    time_taken_ms: timeTakenMs,
  })
}