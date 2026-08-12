import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_RATING, calculateBattleRewards, getRewardMode } from '@/lib/game/scoring'

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

  if (battle.status === 'finished') {
    // Battle already finished — return current scores without updating again
    return NextResponse.json({
      message: 'Battle already finished',
      winner_id:   battle.winner_id,
      host_score:  battle.host_score,
      guest_score: battle.guest_score,
    })
  }

  if (battle.status !== 'active') {
    return NextResponse.json({ error: 'Battle is not active' }, { status: 400 })
  }

  // Tally scores from answers
  const { data: answers } = await adminSupabase
    .from('battle_answers')
    .select('player_id, points_earned, flagged')
    .eq('battle_id', id)

  const totals: Record<string, number> = {}
  const flaggedTotals: Record<string, number> = {}
  const answerCounts: Record<string, number> = {}
  for (const a of (answers ?? [])) {
    totals[a.player_id] = (totals[a.player_id] ?? 0) + a.points_earned
    flaggedTotals[a.player_id] = (flaggedTotals[a.player_id] ?? 0) + (a.flagged ? a.points_earned : 0)
    answerCounts[a.player_id] = (answerCounts[a.player_id] ?? 0) + 1
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
  const { data: markedFinished } = await adminSupabase
    .from('battles')
    .update({
      status:      'finished',
      finished_at: new Date().toISOString(),
      host_score:  hostScore,
      guest_score: guestScore,
      winner_id:   winnerId,
    })
    .eq('id', id)
    .eq('status', 'active')   // only update if currently active (race-condition guard)
    .select('id')
    .single()

  if (!markedFinished) {
    // Another concurrent request already finished this battle — return stored values
    const { data: existing } = await adminSupabase
      .from('battles')
      .select('winner_id, host_score, guest_score')
      .eq('id', id)
      .single()
    return NextResponse.json({
      message:     'Battle already finished',
      winner_id:   existing?.winner_id   ?? null,
      host_score:  existing?.host_score  ?? 0,
      guest_score: existing?.guest_score ?? 0,
    })
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

    const { error: updateError } = await adminSupabase.rpc('apply_profile_battle_result', {
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
      return NextResponse.json({ error: `Failed to update profile: ${updateError.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({
    winner_id:   winnerId,
    host_score:  hostScore,
    guest_score: guestScore,
  })
}
