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

  if (!battle.guest_id) {
    return NextResponse.json({ error: 'Cannot start without an opponent' }, { status: 400 })
  }

  // If either player stakes a card, both sides must stake before the battle can start.
  const hasPartialStake = Boolean(battle.host_staked_inventory_id) !== Boolean(battle.guest_staked_inventory_id)
  if (hasPartialStake) {
    return NextResponse.json(
      { error: 'bet_not_matched', message: 'Waiting for opponent to match the card bet' },
      { status: 400 }
    )
  }

  if (battle.host_staked_inventory_id && battle.guest_staked_inventory_id) {
    const { data: stakedItems } = await adminSupabase
      .from('user_inventory')
      .select('id, user_id')
      .in('id', [battle.host_staked_inventory_id, battle.guest_staked_inventory_id])

    const owners = new Map((stakedItems ?? []).map(item => [item.id, item.user_id]))
    if (
      owners.get(battle.host_staked_inventory_id) !== battle.host_id ||
      owners.get(battle.guest_staked_inventory_id) !== battle.guest_id
    ) {
      return NextResponse.json({ error: 'One or more staked cards are no longer available' }, { status: 409 })
    }
  }

  // Generate questions
  const questions = generateQuestions(
    battle.difficulty as Difficulty,
    battle.question_count
  )

  const now = new Date().toISOString()

  // Insert questions using admin client (bypasses RLS). Upsert makes this
  // idempotent if the host double-clicks start or two requests race.
  const { error: qError } = await adminSupabase
    .from('battle_questions')
    .upsert(
      questions.map((q, i) => ({
        battle_id:      id,
        sequence:       i + 1,
        question_text:  q.question_text,
        correct_answer: q.correct_answer,
        category:       q.category,
        difficulty:     q.difficulty,
        server_sent_at: now,
      })),
      { onConflict: 'battle_id,sequence', ignoreDuplicates: true }
    )

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 })
  }

  // Update battle status (admin client)
  const { data: updatedBattle, error: updateError } = await adminSupabase
    .from('battles')
    .update({
      status:       'active',
      started_at:   now,
      current_turn: battle.host_id,
    })
    .eq('id', id)
    .eq('status', 'waiting')
    .select('id')
    .single()

  if (updateError || !updatedBattle) {
    return NextResponse.json({ error: 'Battle already started' }, { status: 409 })
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
