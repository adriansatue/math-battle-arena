import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_RATING, calculateBattleRewards, getRewardMode } from '@/lib/game/scoring'
import { recordServerEvent } from '@/lib/events/server'
import { getBotLevelConfig, isBotCampaignLevel } from '@/lib/game/bot'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get battle
  const { data: battle } = await adminSupabase
    .from('battles')
    .select('*')
    .eq('id', id)
    .single()

  if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })

  const isParticipant = battle.host_id === user.id || battle.guest_id === user.id
  if (!isParticipant) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  if (battle.status !== 'active' && battle.status !== 'finished') {
    return NextResponse.json({ error: 'Battle is not active' }, { status: 400 })
  }

  // Tally scores from answers
  const { data: answers } = await adminSupabase
    .from('battle_answers')
    .select('player_id, points_earned, is_correct, flagged')
    .eq('battle_id', id)

  const totals: Record<string, number> = {}
  const flaggedTotals: Record<string, number> = {}
  const answerCounts: Record<string, number> = {}
  const correctCounts: Record<string, number> = {}
  for (const a of (answers ?? [])) {
    totals[a.player_id] = (totals[a.player_id] ?? 0) + a.points_earned
    flaggedTotals[a.player_id] = (flaggedTotals[a.player_id] ?? 0) + (a.flagged ? a.points_earned : 0)
    answerCounts[a.player_id] = (answerCounts[a.player_id] ?? 0) + 1
    if (a.is_correct && !a.flagged) {
      correctCounts[a.player_id] = (correctCounts[a.player_id] ?? 0) + 1
    }
  }

  const rewardMode = getRewardMode(battle)
  const participantIds = [battle.host_id, battle.guest_id].filter(Boolean) as string[]
  const incompletePlayer = participantIds.find(playerId =>
    (answerCounts[playerId] ?? 0) < battle.question_count
  )

  if (incompletePlayer) {
    return NextResponse.json(
      { error: 'Battle still in progress', incomplete_player_id: incompletePlayer },
      { status: 409 }
    )
  }

  const hostScore  = totals[battle.host_id]  ?? 0
  const guestScore = totals[battle.guest_id] ?? 0
  const winnerId   = rewardMode === 'practice'
    ? null
    : hostScore > guestScore
      ? battle.host_id
      : guestScore > hostScore
        ? battle.guest_id
        : null // draw

  // Atomic conditional update: only proceeds if battle is still 'active'.
  // Two concurrent finish calls can both read status='active' above, but only one
  // will succeed here — the other will find no rows updated and return early.
  if (battle.status === 'active') {
    const { data: markedFinished, error: finishError } = await adminSupabase
      .from('battles')
      .update({
        status:      'finished',
        finished_at: new Date().toISOString(),
        host_score:  hostScore,
        guest_score: guestScore,
        winner_id:   winnerId,
      })
      .eq('id', id)
      .eq('status', 'active')
      .select('id')
      .single()

    if (finishError && !markedFinished) {
      const { data: concurrentlyFinished } = await adminSupabase
        .from('battles')
        .select('id')
        .eq('id', id)
        .eq('status', 'finished')
        .maybeSingle()

      if (!concurrentlyFinished) {
        return NextResponse.json({ error: 'Failed to finish battle' }, { status: 500 })
      }
    }
  }

  // Settle card bet if active
  if (battle.bet_status === 'matched' && winnerId) {
    const loserId = winnerId === battle.host_id ? battle.guest_id : battle.host_id
    const loserStakedId = loserId === battle.host_id
      ? battle.host_staked_inventory_id
      : battle.guest_staked_inventory_id

    if (loserStakedId && loserId) {
      const { error: transferError } = await adminSupabase
        .from('user_inventory')
        .update({ user_id: winnerId, obtained_via: 'admin_grant' })
        .eq('id', loserStakedId)
        .eq('user_id', loserId)

      if (transferError) {
        console.error(`[finish] wager transfer error for ${loserStakedId}:`, transferError)
        return NextResponse.json({ error: `Failed to settle wager: ${transferError.message}` }, { status: 500 })
      }
    }

    const { error: betError } = await adminSupabase
      .from('battles')
      .update({ bet_status: 'settled' })
      .eq('id', id)
      .eq('bet_status', 'matched')

    if (betError) {
      console.error(`[finish] wager status update error for ${id}:`, betError)
      return NextResponse.json({ error: `Failed to settle wager: ${betError.message}` }, { status: 500 })
    }
  }

  const playerIds = participantIds.filter(playerId => playerId !== battle.bot_id)
  const ratingByPlayer: Record<string, number> = {}

  if (rewardMode === 'pvp' && playerIds.length === 2) {
    const { data: profiles, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, rating')
      .in('id', playerIds)

    if (profileError) {
      return NextResponse.json({ error: `Failed to load player ratings: ${profileError.message}` }, { status: 500 })
    }

    for (const profile of (profiles ?? [])) {
      ratingByPlayer[profile.id] = profile.rating ?? DEFAULT_RATING
    }
  }

  // Update real player profiles with XP, spendable coins, match records, and PvP rating.
  for (const playerId of playerIds) {
    const opponentId = playerIds.find(id => id !== playerId)
    const isWinner = rewardMode !== 'practice' && playerId === winnerId
    const isDraw   = rewardMode !== 'practice' && winnerId === null
    const answerXp = Math.max(0, (totals[playerId] ?? 0) - (flaggedTotals[playerId] ?? 0))
    const rewards = calculateBattleRewards({
      mode:           rewardMode,
      answerXp,
      isWinner,
      isDraw,
      ownRating:      ratingByPlayer[playerId] ?? DEFAULT_RATING,
      opponentRating: opponentId ? ratingByPlayer[opponentId] ?? DEFAULT_RATING : DEFAULT_RATING,
    })

    const { error: updateError } = await adminSupabase.rpc('settle_profile_battle_result', {
      p_battle_id:      id,
      p_profile_id:     playerId,
      p_earned_xp:      rewards.xpEarned,
      p_earned_coins:   rewards.coinsEarned,
      p_is_winner:      isWinner,
      p_is_draw:        isDraw,
      p_record_match:   rewardMode !== 'practice',
      p_rating_delta:   rewards.ratingDelta,
    })

    if (updateError) {
      console.error(`[finish] profile update error for ${playerId}:`, updateError)
      return NextResponse.json({ error: `Failed to settle rewards: ${updateError.message}` }, { status: 500 })
    }
  }

  const durationSeconds = battle.started_at
    ? Math.max(0, Math.round((Date.now() - new Date(battle.started_at).getTime()) / 1000))
    : null

  await Promise.all(playerIds.flatMap(playerId => {
    const playerScore = totals[playerId] ?? 0
    const result = rewardMode === 'practice'
      ? 'completed'
      : winnerId === null
        ? 'draw'
        : winnerId === playerId
          ? 'win'
          : 'loss'
    const events = [recordServerEvent({
      userId: playerId,
      eventName: 'battle_finished',
      dedupKey: `battle:${id}:finished`,
      battleId: id,
      properties: {
        mode: rewardMode,
        difficulty: battle.difficulty,
        result,
        score: playerScore,
        answer_count: answerCounts[playerId] ?? 0,
        duration_seconds: durationSeconds,
        opponent_type: battle.bot_id ? 'bot' : rewardMode === 'practice' ? 'none' : 'human',
      },
    })]

    if (rewardMode === 'practice') {
      events.push(recordServerEvent({
        userId: playerId,
        eventName: 'practice_finished',
        dedupKey: `practice:${id}:finished`,
        battleId: id,
        properties: {
          difficulty: battle.difficulty,
          score: playerScore,
          answer_count: answerCounts[playerId] ?? 0,
          duration_seconds: durationSeconds,
        },
      }))
    }

    return events
  }))

  let practiceSummary = null
  let campaignResult = null
  if (rewardMode === 'practice') {
    const { data, error: practiceError } = await adminSupabase.rpc('complete_focused_practice', {
      p_battle_id: id,
      p_user_id: battle.host_id,
    })

    if (practiceError) {
      console.error(`[finish] practice summary error for ${id}:`, practiceError)
    } else {
      practiceSummary = Array.isArray(data) ? data[0] ?? null : data
    }
  }

  if (rewardMode === 'pvp') {
    await Promise.all(playerIds.map(async playerId => {
      const { error: weeklyError } = await adminSupabase.rpc('record_weekly_competition_result', {
        p_user_id: playerId,
        p_battle_id: id,
      })
      if (weeklyError) {
        console.error(`[finish] weekly competition error for ${playerId}:`, weeklyError.message)
      }
    }))
  }

  if (rewardMode === 'bot' && isBotCampaignLevel(battle.bot_level)) {
    const config = getBotLevelConfig(battle.bot_level)
    const { data, error: campaignError } = await adminSupabase.rpc('settle_bot_campaign_victory', {
      p_user_id: user.id,
      p_battle_id: id,
      p_bonus_coins: config.firstWinCoins,
    })
    if (campaignError) {
      console.error(`[finish] bot campaign error for ${id}:`, campaignError.message)
    } else {
      campaignResult = data
    }
  }

  await Promise.all(playerIds.map(async playerId => {
    const isFocusedPractice = rewardMode === 'practice'
      && practiceSummary !== null
      && practiceSummary.source !== 'manual'
    const { error: activityError } = await adminSupabase.rpc('record_daily_activity', {
      p_user_id: playerId,
      p_battle_id: id,
      p_correct_answers: correctCounts[playerId] ?? 0,
      p_is_competitive_battle: rewardMode !== 'practice',
      p_is_focused_practice: isFocusedPractice,
    })

    if (activityError) {
      console.error(`[finish] daily activity error for ${playerId}:`, activityError.message)
    }
  }))

  return NextResponse.json({
    winner_id:   winnerId,
    host_score:  hostScore,
    guest_score: guestScore,
    practice_summary: practiceSummary,
    campaign_result: campaignResult,
  })
}
