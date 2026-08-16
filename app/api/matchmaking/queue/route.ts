import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timeLimits } from '@/lib/game/questions'
import type { Difficulty } from '@/lib/game/questions'
import { isUniqueViolation } from '@/lib/supabase/errors'
import { cleanupInactiveBattles } from '@/lib/game/battle-cleanup'
import { DEFAULT_RATING } from '@/lib/game/scoring'
import { recordServerEvent } from '@/lib/events/server'

const MODES = ['realtime', 'turnbased'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const MATCH_CANDIDATE_LIMIT = 20
const MATCH_BASE_RATING_RANGE = 180
const MATCH_MAX_RATING_RANGE = 650
const MATCH_WIDEN_EVERY_MS = 10_000
const MATCH_RATING_STEP = 120

type QueueCandidate = {
  id: string
  user_id: string
  queued_at: string | null
}

type MatchProfile = {
  id: string
  rating: number | null
  level: number | null
}

function numberOrDefault(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function queueWaitMs(queuedAt: string | null) {
  if (!queuedAt) return 0
  const queuedTime = new Date(queuedAt).getTime()
  if (!Number.isFinite(queuedTime)) return 0
  return Math.max(0, Date.now() - queuedTime)
}

function ratingWindow(waitMs: number) {
  const widened = MATCH_BASE_RATING_RANGE + Math.floor(waitMs / MATCH_WIDEN_EVERY_MS) * MATCH_RATING_STEP
  return Math.min(MATCH_MAX_RATING_RANGE, widened)
}

function levelWindow(waitMs: number) {
  return waitMs >= 30_000 ? 4 : 2
}

function pickBestOpponent(
  candidates: QueueCandidate[],
  profiles: MatchProfile[],
  ownRating: number,
  ownLevel: number
) {
  const profileById = new Map(profiles.map(profile => [profile.id, profile]))

  return candidates
    .map(candidate => {
      const profile = profileById.get(candidate.user_id)
      const candidateRating = numberOrDefault(profile?.rating, DEFAULT_RATING)
      const candidateLevel = numberOrDefault(profile?.level, 1)
      const waitMs = queueWaitMs(candidate.queued_at)
      const ratingDiff = Math.abs(candidateRating - ownRating)
      const levelDiff = Math.abs(candidateLevel - ownLevel)
      const acceptable = ratingDiff <= ratingWindow(waitMs) && levelDiff <= levelWindow(waitMs)

      return {
        candidate,
        acceptable,
        ratingDiff,
        levelDiff,
        waitMs,
        score: ratingDiff + levelDiff * 80 - waitMs / 1000,
      }
    })
    .filter(match => match.acceptable)
    .sort((a, b) => a.score - b.score)[0] ?? null
}

async function enqueueUser(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  mode: string,
  difficulty: string
) {
  return adminSupabase
    .from('matchmaking_queue')
    .insert({
      user_id:   userId,
      mode,
      difficulty,
      queued_at: new Date().toISOString(),
    })
}

async function addUserToQueue(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  mode: string,
  difficulty: string
) {
  const { error } = await enqueueUser(adminSupabase, userId, mode, difficulty)
  if (error && !isUniqueViolation(error)) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recordServerEvent({
    userId,
    eventName: 'matchmaking_started',
    dedupKey: `queue:${mode}:${difficulty}:${Date.now()}`,
    properties: { mode, difficulty, queued: true },
  })

  return NextResponse.json({
    matched: false,
    message: error ? 'Already in queue' : 'Finding a similarly rated opponent',
  })
}

export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { mode, difficulty } = await request.json().catch(() => ({}))

  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  if (!DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
  }

  await cleanupInactiveBattles(adminSupabase)

  await adminSupabase
    .from('matchmaking_queue')
    .delete()
    .eq('user_id', user.id)

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('rating, level')
    .eq('id', user.id)
    .single()

  const ownRating = numberOrDefault(profile?.rating, DEFAULT_RATING)
  const ownLevel = numberOrDefault(profile?.level, 1)

  const { data: candidates } = await adminSupabase
    .from('matchmaking_queue')
    .select('id, user_id, queued_at')
    .eq('mode', mode)
    .eq('difficulty', difficulty)
    .neq('user_id', user.id)
    .order('queued_at', { ascending: true })
    .limit(MATCH_CANDIDATE_LIMIT)

  if (!candidates || candidates.length === 0) {
    return addUserToQueue(adminSupabase, user.id, mode, difficulty)
  }

  const candidateRows = candidates as QueueCandidate[]
  const candidateIds = candidateRows.map(candidate => candidate.user_id)
  const { data: candidateProfiles } = await adminSupabase
    .from('profiles')
    .select('id, rating, level')
    .in('id', candidateIds)

  const match = pickBestOpponent(
    candidateRows,
    (candidateProfiles ?? []) as MatchProfile[],
    ownRating,
    ownLevel
  )

  if (!match) {
    return addUserToQueue(adminSupabase, user.id, mode, difficulty)
  }

  const opponent = match.candidate
  const { data: claimedOpponent } = await adminSupabase
    .from('matchmaking_queue')
    .delete()
    .eq('id', opponent.id)
    .select('id, user_id')
    .single()

  if (!claimedOpponent) {
    return addUserToQueue(adminSupabase, user.id, mode, difficulty)
  }

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

  const { generateQuestions } = await import('@/lib/game/questions')
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
    return NextResponse.json({ error: questionsError.message }, { status: 500 })
  }

  const { error: updateError } = await adminSupabase
    .from('battles')
    .update({
      status:       'active',
      started_at:   now,
      current_turn: battle.host_id,
    })
    .eq('id', battle.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await Promise.all([
    recordServerEvent({
      userId: user.id,
      eventName: 'matchmaking_started',
      dedupKey: `battle:${battle.id}:matchmaking`,
      battleId: battle.id,
      properties: { mode, difficulty, queued: false },
    }),
    ...[user.id, opponent.user_id].map(playerId => recordServerEvent({
      userId: playerId,
      eventName: 'match_found',
      dedupKey: `battle:${battle.id}:match`,
      battleId: battle.id,
      properties: {
        mode,
        difficulty,
        rating_diff: Math.round(match.ratingDiff),
        level_diff: match.levelDiff,
        wait_ms: Math.round(match.waitMs),
      },
    })),
    ...[user.id, opponent.user_id].map(playerId => recordServerEvent({
      userId: playerId,
      eventName: 'battle_started',
      dedupKey: `battle:${battle.id}:started`,
      battleId: battle.id,
      properties: { mode, difficulty, question_count: 10, opponent_type: 'human' },
    })),
  ])

  return NextResponse.json({
    matched:    true,
    battle_id:  battle.id,
    mode:       battle.mode,
    difficulty: battle.difficulty,
    match_quality: {
      rating_diff: Math.round(match.ratingDiff),
      level_diff:  match.levelDiff,
      wait_ms:     Math.round(match.waitMs),
    },
  })
}

export async function GET() {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
  await cleanupInactiveBattles(adminSupabase)

  const { data: hostBattle } = await adminSupabase
    .from('battles')
    .select('id, status, host_id, guest_id')
    .eq('host_id', user.id)
    .eq('status', 'active')
    .not('guest_id', 'is', null)
    .gte('created_at', thirtySecondsAgo)
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
    .gte('created_at', thirtySecondsAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (guestBattle) {
    return NextResponse.json({ matched: true, battle_id: guestBattle.id })
  }

  return NextResponse.json({ matched: false })
}

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
