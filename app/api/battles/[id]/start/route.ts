import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateQuestions } from '@/lib/game/questions'
import type { Difficulty } from '@/lib/game/questions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch battle (regular client — RLS checks participant)
  const { data: battle, error: battleError } = await supabase
    .from('battles')
    .select('*')
    .eq('id', id)
    .single()

  if (battleError || !battle) {
    return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  }

  if (battle.host_id !== user.id) {
    return NextResponse.json({ error: 'Only the host can start the battle' }, { status: 403 })
  }

  if (battle.status !== 'waiting') {
    return NextResponse.json({ error: 'Battle already started' }, { status: 400 })
  }

  // If host staked a card, guest must also stake before the battle can start
  if (battle.host_staked_inventory_id && !battle.guest_staked_inventory_id) {
    return NextResponse.json(
      { error: 'bet_not_matched', message: 'Waiting for opponent to match the card bet' },
      { status: 400 }
    )
  }

  // Generate questions
  const questions = generateQuestions(
    battle.difficulty as Difficulty,
    battle.question_count
  )

  const now = new Date().toISOString()

  // Insert questions using admin client (bypasses RLS)
  const { error: qError } = await adminSupabase
    .from('battle_questions')
    .insert(
      questions.map((q, i) => ({
        battle_id:      id,
        sequence:       i + 1,
        question_text:  q.question_text,
        correct_answer: q.correct_answer,
        category:       q.category,
        difficulty:     q.difficulty,
        server_sent_at: now,
      }))
    )

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 })
  }

  // Update battle status (admin client)
  const { error: updateError } = await adminSupabase
    .from('battles')
    .update({
      status:       'active',
      started_at:   now,
      current_turn: battle.host_id,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Update all questions' server_sent_at to NOW (not when they were created)
  // This ensures accurate timing for the first player who loads the questions
  const nowAfterInsert = new Date().toISOString()
  await adminSupabase
    .from('battle_questions')
    .update({ server_sent_at: nowAfterInsert })
    .eq('battle_id', id)

  return NextResponse.json({
    message:   'Battle started!',
    questions: questions.map((q, i) => ({
      sequence:      i + 1,
      question_text: q.question_text,
      category:      q.category,
    })),
  })
}