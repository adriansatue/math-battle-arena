import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timeLimits, generateTargetedQuestions } from '@/lib/game/questions'
import type { Difficulty, Category, PracticeOptions } from '@/lib/game/questions'

export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    category,
    difficulty,
    question_count = 10,
    options = {}
  } = await request.json()

  const questions = generateTargetedQuestions(
    category  as Category,
    difficulty as Difficulty,
    question_count,
    options   as PracticeOptions
  )

  const now = new Date().toISOString()

  const { data: battle, error } = await adminSupabase
    .from('battles')
    .insert({
      host_id:         user.id,
      guest_id:        null,
      mode:            'realtime',
      difficulty,
      question_count:  questions.length,
      time_per_q_secs: timeLimits[difficulty as Difficulty],
      status:          'active',
      started_at:      now,
    })
    .select()
    .single()

  if (error || !battle) {
    return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  }

  await adminSupabase
    .from('battle_questions')
    .insert(questions.map((q, i) => ({
      battle_id:      battle.id,
      sequence:       i + 1,
      question_text:  q.question_text,
      correct_answer: q.correct_answer,
      category:       q.category,
      difficulty:     q.difficulty,
      server_sent_at: now,
    })))

  return NextResponse.json({ session_id: battle.id })
}