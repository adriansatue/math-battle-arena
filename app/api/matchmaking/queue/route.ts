import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timeLimits } from '@/lib/game/questions'
import type { Difficulty } from '@/lib/game/questions'

// POST — join the queue or get matched
export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { mode, difficulty } = await request.json()

  // Remove any existing queue entry for this user
  await adminSupabase
    .from('matchmaking_queue')
    .delete()
    .eq('user_id', user.id)

  // Look for an existing opponent in the queue
  const { data: opponent } = await adminSupabase
    .from('matchmaking_queue')
    .select('*')
    .eq('mode', mode)
    .eq('difficulty', difficulty)
    .neq('user_id', user.id)
    .order('queued_at', { ascending: true })
    .limit(1)
    .single()

  if (opponent) {
    // Match found! Remove opponent from queue
    await adminSupabase
      .from('matchmaking_queue')
      .delete()
      .eq('id', opponent.id)

    const { data: battle, error: battleError } = await adminSupabase
      .from('battles')
      .insert({
        host_id:         opponent.user_id,
        guest_id:        user.id,
        mode,
        difficulty,
        question_count:  10,
        time_per_q_secs: timeLimits[difficulty as Difficulty],
        status:          'waiting',
      })
      .select()
      .single()

    if (battleError || !battle) {
      return NextResponse.json({ error: 'Failed to create battle' }, { status: 500 })
    }

    // ── AUTO-START: generate questions immediately ──
    const { generateQuestions } = await import('@/lib/game/questions')
    const questions = generateQuestions(difficulty as Difficulty, 10)
    const now = new Date().toISOString()

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

    await adminSupabase
      .from('battles')
      .update({
        status:       'active',
        started_at:   now,
        current_turn: battle.host_id,
      })
      .eq('id', battle.id)

    return NextResponse.json({
      matched:    true,
      battle_id:  battle.id,
      mode:       battle.mode,
      difficulty: battle.difficulty,
    })
  }

  // No opponent yet — add to queue
  const { error: queueError } = await adminSupabase
    .from('matchmaking_queue')
    .insert({
      user_id:   user.id,
      mode,
      difficulty,
      queued_at: new Date().toISOString(),
    })

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 })
  }

  return NextResponse.json({ matched: false, message: 'Added to queue' })
}

// GET — check if user has been matched into a battle
export async function GET() {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only look for battles created in the last 30 seconds
  const fiveMinutesAgo = new Date(Date.now() - 30 * 1000).toISOString()

  const { data: hostBattle } = await adminSupabase
    .from('battles')
    .select('id, status, host_id, guest_id')
    .eq('host_id', user.id)
    .eq('status', 'active')
    .not('guest_id', 'is', null)
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (hostBattle) {
    return NextResponse.json({ matched: true, battle_id: hostBattle.id })
  }

  const { data: guestBattle } = await adminSupabase
    .from('battles')
    .select('id, status, host_id, guest_id')
    .eq('guest_id', user.id)
    .eq('status', 'active')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (guestBattle) {
    return NextResponse.json({ matched: true, battle_id: guestBattle.id })
  }

  return NextResponse.json({ matched: false })
}

// DELETE — leave the queue
export async function DELETE() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await adminSupabase
    .from('matchmaking_queue')
    .delete()
    .eq('user_id', user.id)

  return NextResponse.json({ message: 'Left queue' })
}