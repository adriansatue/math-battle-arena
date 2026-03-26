import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLevelAndRank } from '@/lib/game/scoring'

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
  if (battle.status === 'finished') {
    // Battle already finished — return current scores without updating again
    return NextResponse.json({
      message: 'Battle already finished',
      winner_id:   battle.winner_id,
      host_score:  battle.host_score,
      guest_score: battle.guest_score,
    })
  }

  // Tally scores from answers
  const { data: answers } = await adminSupabase
    .from('battle_answers')
    .select('player_id, points_earned')
    .eq('battle_id', id)

  const totals: Record<string, number> = {}
  for (const a of (answers ?? [])) {
    totals[a.player_id] = (totals[a.player_id] ?? 0) + a.points_earned
  }

  const hostScore  = totals[battle.host_id]  ?? 0
  const guestScore = totals[battle.guest_id] ?? 0
  const winnerId   = hostScore > guestScore
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
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/battles/${id}/settle-bet`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ winner_id: winnerId }),
    })
  }

  // Update profiles for both players
  const playerIds = [battle.host_id, battle.guest_id].filter(Boolean) as string[]
  for (const playerId of playerIds) {
    const isWinner = playerId === winnerId
    const isDraw   = winnerId === null

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('total_points, points_balance, wins, losses, current_streak, best_streak')
      .eq('id', playerId)
      .single()

    if (!profile) continue

    const earnedPoints = (totals[playerId] ?? 0) + (isWinner ? 200 : 0)
    const newPoints    = profile.total_points + earnedPoints
    const newBalance   = (profile.points_balance ?? profile.total_points) + earnedPoints
    const { level, rank_title } = getLevelAndRank(newPoints)

    let newWins          = profile.wins
    let newLosses        = profile.losses
    let newCurrentStreak = profile.current_streak
    let newBestStreak    = profile.best_streak

    if (isWinner) {
      newWins          = profile.wins + 1
      newCurrentStreak = profile.current_streak + 1
      newBestStreak    = Math.max(profile.best_streak, newCurrentStreak)
    } else if (!isDraw) {
      // Loss
      newLosses        = profile.losses + 1
      newCurrentStreak = 0
    }
    // Draw: wins/losses/streak unchanged

    const { error: updateError } = await adminSupabase
      .from('profiles')
      .update({
        total_points:    newPoints,
        points_balance:  newBalance,
        wins:            newWins,
        losses:          newLosses,
        current_streak:  newCurrentStreak,
        best_streak:     newBestStreak,
        level,
        rank_title,
      })
      .eq('id', playerId)

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