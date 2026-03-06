import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateQuestions } from '@/lib/game/questions'
import { timeLimits } from '@/lib/game/questions'
import type { Difficulty } from '@/lib/game/questions'

const BOT_META = {
  easy:   { email: 'bot-easy@mathbattle.internal',   username: '🤖 MathBot Easy',   level: 2 },
  medium: { email: 'bot-medium@mathbattle.internal', username: '🤖 MathBot Medium', level: 5 },
  hard:   { email: 'bot-hard@mathbattle.internal',   username: '🤖 MathBot Hard',   level: 8 },
}

/** Looks up (or creates) a real auth user for the bot and returns their UUID. */
async function getOrCreateBot(
  adminSupabase: ReturnType<typeof createAdminClient>,
  diff: 'easy' | 'medium' | 'hard'
) {
  const meta = BOT_META[diff]

  // Check if the auth user already exists
  const { data: existing } = await adminSupabase.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === meta.email)
  if (found) {
    // Make sure the profile row is in sync
    await adminSupabase.from('profiles').upsert({
      id:           found.id,
      username:     meta.username,
      level:        meta.level,
      rank_title:   'AI Challenger',
      total_points: 0,
      wins:         0,
      losses:       0,
    }, { onConflict: 'id' })
    return found.id
  }

  // Create a new auth user for the bot
  const { data: created, error: createErr } = await adminSupabase.auth.admin.createUser({
    email:         meta.email,
    password:      crypto.randomUUID(), // random — bot never logs in
    email_confirm: true,
  })
  if (createErr || !created?.user) {
    throw new Error(`Failed to create bot auth user: ${createErr?.message}`)
  }

  await adminSupabase.from('profiles').upsert({
    id:           created.user.id,
    username:     meta.username,
    level:        meta.level,
    rank_title:   'AI Challenger',
    total_points: 0,
    wins:         0,
    losses:       0,
  }, { onConflict: 'id' })

  return created.user.id
}

export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mode, difficulty, bot_difficulty } = await request.json()
  const diff = (bot_difficulty ?? difficulty ?? 'medium') as 'easy' | 'medium' | 'hard'

  let botId: string
  try {
    botId = await getOrCreateBot(adminSupabase, diff)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bot] getOrCreateBot error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Remove user from matchmaking queue
  await adminSupabase
    .from('matchmaking_queue')
    .delete()
    .eq('user_id', user.id)

  // Create battle with bot
  const { data: battle, error } = await adminSupabase
    .from('battles')
    .insert({
      host_id:         user.id,
      guest_id:        botId,
      mode,
      difficulty,
      question_count:  10,
      time_per_q_secs: timeLimits[difficulty as Difficulty],
      status:          'waiting',
    })
    .select()
    .single()

  if (error || !battle) {
    console.error('[bot] battle insert error:', error?.message)
    return NextResponse.json({ error: error?.message ?? 'Failed to create bot battle' }, { status: 500 })
  }

  // Generate questions
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
    .update({ status: 'active', started_at: now })
    .eq('id', battle.id)

  return NextResponse.json({ battle_id: battle.id, bot_username: BOT_META[diff].username })
}