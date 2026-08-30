import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBotAnswer, getBotDelay, getCampaignBotAnswer, getCampaignBotDelay, isBotCampaignLevel } from '@/lib/game/bot'
import type { BotDifficulty } from '@/lib/game/bot'
import { calculatePoints } from '@/lib/game/scoring'
import type { Difficulty } from '@/lib/game/questions'
import { isUniqueViolation } from '@/lib/supabase/errors'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question_id } = await request.json()

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

  if (battle.status !== 'active') {
    return NextResponse.json({ error: 'Battle is not active' }, { status: 400 })
  }

  if (battle.host_id !== user.id && battle.guest_id !== user.id) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  if (user.id === battle.bot_id) {
    return NextResponse.json({ error: 'Bot user cannot trigger bot answer' }, { status: 403 })
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

  const diff = (battle.difficulty ?? 'medium') as BotDifficulty
  const campaignLevel = isBotCampaignLevel(battle.bot_level) ? battle.bot_level : null
  const { answer, isCorrect } = campaignLevel
    ? getCampaignBotAnswer(Number(question.correct_answer), campaignLevel)
    : getBotAnswer(Number(question.correct_answer), diff)

  const timeTakenMs = campaignLevel ? getCampaignBotDelay(campaignLevel) : getBotDelay(diff)

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
  const { error: insertError } = await adminSupabase
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

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      return NextResponse.json({ message: 'Already answered' })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    points_earned: pointsEarned,
    time_taken_ms: timeTakenMs,
  })
}
