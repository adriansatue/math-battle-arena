import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { timeLimits } from '@/lib/game/questions'
import type { Difficulty } from '@/lib/game/questions'

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { mode, difficulty, question_count = 10 } = body

  // Validate inputs
  if (!['realtime', 'turnbased'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
  }
  if (!Number.isFinite(question_count) || question_count < 1 || question_count > 50) {
    return NextResponse.json({ error: 'question_count must be between 1 and 50' }, { status: 400 })
  }

  const { data: battle, error } = await supabase
    .from('battles')
    .insert({
      host_id:        user.id,
      mode,
      difficulty,
      question_count,
      time_per_q_secs: timeLimits[difficulty as Difficulty],
      invite_code:    generateInviteCode(),
      status:         'waiting',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ battle }, { status: 201 })
}