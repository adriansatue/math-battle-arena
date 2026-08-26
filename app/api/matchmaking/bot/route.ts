import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateQuestions } from '@/lib/game/questions'
import { timeLimits } from '@/lib/game/questions'
import type { Difficulty } from '@/lib/game/questions'
import { cleanupInactiveBattles } from '@/lib/game/battle-cleanup'
import { recordServerEvent } from '@/lib/events/server'

const MODES = ['realtime', 'turnbased'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

const BOT_META = {
  easy:   { email: 'bot-easy@mathbattle.internal',   username: '🤖 MathBot Easy',   level: 2 },
  medium: { email: 'bot-medium@mathbattle.internal', username: '🤖 MathBot Medium', level: 5 },
  hard:   { email: 'bot-hard@mathbattle.internal',   username: '🤖 MathBot Hard',   level: 8 },
}

const AUTH_PAGE_SIZE = 1000

async function findAuthUserByEmail(
  adminSupabase: ReturnType<typeof createAdminClient>,
  email: string
) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (error) throw new Error(`Failed to search bot auth user: ${error.message}`)

    const found = data.users.find(user => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < AUTH_PAGE_SIZE) return null
  }
}

async function syncBotProfile(
  adminSupabase: ReturnType<typeof createAdminClient>,
  botId: string,
  diff: 'easy' | 'medium' | 'hard',
  initializeStats = false
) {
  const meta = BOT_META[diff]
  await adminSupabase.from('profiles').upsert({
    id: botId,
    username: meta.username,
    level: meta.level,
    rank_title: 'AI Challenger',
    ...(initializeStats ? { total_points: 0, wins: 0, losses: 0 } : {}),
  }, { onConflict: 'id' })
}

/** Looks up (or creates) a real auth user for the bot and returns their UUID. */
export async function getOrCreateBot(
  adminSupabase: ReturnType<typeof createAdminClient>,
  diff: 'easy' | 'medium' | 'hard'
) {
  const meta = BOT_META[diff]

  const found = await findAuthUserByEmail(adminSupabase, meta.email)
  if (found) {
    await syncBotProfile(adminSupabase, found.id, diff)
    return found.id
  }

  // Create a new auth user for the bot
  const { data: created, error: createErr } = await adminSupabase.auth.admin.createUser({
    email:         meta.email,
    password:      crypto.randomUUID(), // random — bot never logs in
    email_confirm: true,
  })
  if (createErr || !created?.user) {
    if (createErr?.message.toLowerCase().includes('already been registered')) {
      const concurrentlyCreated = await findAuthUserByEmail(adminSupabase, meta.email)
      if (concurrentlyCreated) {
        await syncBotProfile(adminSupabase, concurrentlyCreated.id, diff)
        return concurrentlyCreated.id
      }
    }
    throw new Error(`Failed to create bot auth user: ${createErr?.message}`)
  }

  await syncBotProfile(adminSupabase, created.user.id, diff, true)

  return created.user.id
}

export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mode, difficulty, bot_difficulty } = await request.json()

  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  if (!DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
  }

  const requestedBotDifficulty = bot_difficulty ?? difficulty
  if (!DIFFICULTIES.includes(requestedBotDifficulty)) {
    return NextResponse.json({ error: 'Invalid bot difficulty' }, { status: 400 })
  }
  const diff = requestedBotDifficulty as Difficulty
  await cleanupInactiveBattles(adminSupabase)

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
      bot_id:          botId,
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

  const { error: questionsError } = await adminSupabase
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

  if (questionsError) {
    console.error('[bot] question insert error:', questionsError.message)
    return NextResponse.json({ error: 'Failed to create bot battle questions' }, { status: 500 })
  }

  const { error: updateError } = await adminSupabase
    .from('battles')
    .update({ status: 'active', started_at: now })
    .eq('id', battle.id)

  if (updateError) {
    console.error('[bot] battle activation error:', updateError.message)
    return NextResponse.json({ error: 'Failed to activate bot battle' }, { status: 500 })
  }

  await Promise.all([
    recordServerEvent({
      userId: user.id,
      eventName: 'bot_fallback_started',
      dedupKey: `battle:${battle.id}:bot-fallback`,
      battleId: battle.id,
      properties: { mode, difficulty, bot_difficulty: diff },
    }),
    recordServerEvent({
      userId: user.id,
      eventName: 'battle_started',
      dedupKey: `battle:${battle.id}:started`,
      battleId: battle.id,
      properties: { mode, difficulty, question_count: 10, opponent_type: 'bot' },
    }),
  ])

  return NextResponse.json({ battle_id: battle.id, bot_username: BOT_META[diff].username })
}
