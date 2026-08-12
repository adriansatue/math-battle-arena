import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_RATING, calculateBattleRewards, getRewardMode } from '@/lib/game/scoring'

type AdminClient = ReturnType<typeof createAdminClient>

type BattleRow = {
  id: string
  host_id: string | null
  guest_id: string | null
  bot_id: string | null
  status: 'waiting' | 'active' | 'finished'
  bet_status: string | null
  host_staked_inventory_id: string | null
  guest_staked_inventory_id: string | null
  created_at: string | null
  started_at: string | null
}

type AnswerRow = {
  player_id: string | null
  points_earned: number | null
  flagged: boolean | null
  answered_at: string | null
}

export const INACTIVE_BATTLE_MS = 60_000

function timestamp(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0
}

function addScore(totals: Record<string, number>, playerId: string | null, points: number | null) {
  if (!playerId) return
  totals[playerId] = (totals[playerId] ?? 0) + (points ?? 0)
}

async function applyExpiredBattleRewards(
  admin: AdminClient,
  battle: BattleRow,
  totals: Record<string, number>,
  flaggedTotals: Record<string, number>,
  winnerId: string | null
) {
  const rewardMode = getRewardMode(battle)
  const playerIds = [battle.host_id, battle.guest_id]
    .filter((id): id is string => Boolean(id))
    .filter(playerId => playerId !== battle.bot_id)
  const ratingByPlayer: Record<string, number> = {}

  if (rewardMode === 'pvp' && playerIds.length === 2) {
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id, rating')
      .in('id', playerIds)

    if (error) {
      console.error(`[battle-cleanup] rating query error for ${battle.id}:`, error.message)
      return
    }

    for (const profile of (profiles ?? [])) {
      ratingByPlayer[profile.id] = profile.rating ?? DEFAULT_RATING
    }
  }

  for (const playerId of playerIds) {
    const opponentId = playerIds.find(id => id !== playerId)
    const isWinner = rewardMode !== 'practice' && playerId === winnerId
    const isDraw = rewardMode !== 'practice' && winnerId === null
    const answerXp = Math.max(0, (totals[playerId] ?? 0) - (flaggedTotals[playerId] ?? 0))
    const rewards = calculateBattleRewards({
      mode:           rewardMode,
      answerXp,
      isWinner,
      isDraw,
      ownRating:      ratingByPlayer[playerId] ?? DEFAULT_RATING,
      opponentRating: opponentId ? ratingByPlayer[opponentId] ?? DEFAULT_RATING : DEFAULT_RATING,
    })

    const { error } = await admin.rpc('apply_profile_battle_result', {
      p_profile_id:     playerId,
      p_earned_xp:      rewards.xpEarned,
      p_earned_coins:   rewards.coinsEarned,
      p_is_winner:      isWinner,
      p_is_draw:        isDraw,
      p_record_match:   rewardMode !== 'practice',
      p_rating_delta:   rewards.ratingDelta,
    })

    if (error) {
      console.error(`[battle-cleanup] profile reward error for ${playerId}:`, error.message)
    }
  }
}

async function settleExpiredWager(admin: AdminClient, battle: BattleRow, winnerId: string | null) {
  if (battle.bet_status !== 'matched' || !winnerId) return

  const loserId = winnerId === battle.host_id ? battle.guest_id : battle.host_id
  const loserStakedId = loserId === battle.host_id
    ? battle.host_staked_inventory_id
    : battle.guest_staked_inventory_id

  if (loserStakedId && loserId) {
    const { error } = await admin
      .from('user_inventory')
      .update({ user_id: winnerId, obtained_via: 'admin_grant' })
      .eq('id', loserStakedId)
      .eq('user_id', loserId)

    if (error) {
      console.error(`[battle-cleanup] wager transfer error for ${battle.id}:`, error.message)
      return
    }
  }

  const { error } = await admin
    .from('battles')
    .update({ bet_status: 'settled' })
    .eq('id', battle.id)
    .eq('bet_status', 'matched')

  if (error) {
    console.error(`[battle-cleanup] wager status error for ${battle.id}:`, error.message)
  }
}

export async function cleanupInactiveBattles(
  admin: AdminClient,
  nowMs = Date.now()
) {
  const cutoffMs = nowMs - INACTIVE_BATTLE_MS
  const cutoffIso = new Date(cutoffMs).toISOString()
  let closed = 0

  const { data: candidates, error } = await admin
    .from('battles')
    .select('id, host_id, guest_id, bot_id, status, bet_status, host_staked_inventory_id, guest_staked_inventory_id, created_at, started_at')
    .in('status', ['waiting', 'active'])
    .lt('created_at', cutoffIso)
    .limit(50)

  if (error) {
    console.error('[battle-cleanup] candidate query error:', error.message)
    return { closed, error: error.message }
  }

  for (const battle of ((candidates ?? []) as BattleRow[])) {
    if (battle.status === 'waiting') {
      const { data: updated } = await admin
        .from('battles')
        .update({
          status:      'finished',
          finished_at: new Date(nowMs).toISOString(),
          host_score:  0,
          guest_score: 0,
          winner_id:   null,
        })
        .eq('id', battle.id)
        .eq('status', 'waiting')
        .select('id')
        .single()

      if (updated) closed++
      continue
    }

    const { data: answers, error: answersError } = await admin
      .from('battle_answers')
      .select('player_id, points_earned, flagged, answered_at')
      .eq('battle_id', battle.id)
      .order('answered_at', { ascending: false })

    if (answersError) {
      console.error(`[battle-cleanup] answers query error for ${battle.id}:`, answersError.message)
      continue
    }

    const answerRows = (answers ?? []) as AnswerRow[]
    const lastAnswerAt = answerRows[0]?.answered_at ?? null
    const lastActivityMs = timestamp(lastAnswerAt) || timestamp(battle.started_at) || timestamp(battle.created_at)
    if (lastActivityMs > cutoffMs) continue

    const totals: Record<string, number> = {}
    const flaggedTotals: Record<string, number> = {}
    for (const answer of answerRows) {
      addScore(totals, answer.player_id, answer.points_earned)
      if (answer.flagged) addScore(flaggedTotals, answer.player_id, answer.points_earned)
    }

    const hostScore = battle.host_id ? totals[battle.host_id] ?? 0 : 0
    const guestScore = battle.guest_id ? totals[battle.guest_id] ?? 0 : 0
    const winnerId = !battle.guest_id
      ? null
      : hostScore > guestScore
      ? battle.host_id
      : guestScore > hostScore
      ? battle.guest_id
      : null

    const { data: updated } = await admin
      .from('battles')
      .update({
        status:      'finished',
        finished_at: new Date(nowMs).toISOString(),
        host_score:  hostScore,
        guest_score: guestScore,
        winner_id:   winnerId,
      })
      .eq('id', battle.id)
      .eq('status', 'active')
      .select('id')
      .single()

    if (updated) {
      closed++
      await settleExpiredWager(admin, battle, winnerId)
      await applyExpiredBattleRewards(admin, battle, totals, flaggedTotals, winnerId)
    }
  }

  return { closed }
}
