import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  if (battle.status === 'finished') return NextResponse.json({ message: 'Already finished' })

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

  // Update battle to finished
  await adminSupabase
    .from('battles')
    .update({
      status:      'finished',
      finished_at: new Date().toISOString(),
      host_score:  hostScore,
      guest_score: guestScore,
      winner_id:   winnerId,
    })
    .eq('id', id)

  // Settle card bet if active
  if (battle.bet_status === 'matched' && winnerId) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/battles/${id}/settle-bet`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ winner_id: winnerId }),
    })
  }

  // Update winner profile — add points + increment wins
  if (winnerId) {
    const { data: winnerProfile } = await adminSupabase
      .from('profiles')
      .select('total_points, wins, current_streak, best_streak')
      .eq('id', winnerId)
      .single()

    if (winnerProfile) {
      const newPoints = winnerProfile.total_points + (totals[winnerId] ?? 0) + 200
      const newStreak = winnerProfile.current_streak + 1

      await adminSupabase
        .from('profiles')
        .update({
          total_points:    newPoints,
          wins:            winnerProfile.wins + 1,
          current_streak:  newStreak,
          best_streak:     Math.max(winnerProfile.best_streak, newStreak),
        })
        .eq('id', winnerId)
    }

    // Update loser profile — add points + increment losses + reset streak
    const loserId = winnerId === battle.host_id ? battle.guest_id : battle.host_id
    if (loserId) {
      const { data: loserProfile } = await adminSupabase
        .from('profiles')
        .select('total_points, losses')
        .eq('id', loserId)
        .single()

      if (loserProfile) {
        await adminSupabase
          .from('profiles')
          .update({
            total_points:   loserProfile.total_points + (totals[loserId] ?? 0),
            losses:         loserProfile.losses + 1,
            current_streak: 0,
          })
          .eq('id', loserId)
      }
    }
  }

  return NextResponse.json({
    winner_id:   winnerId,
    host_score:  hostScore,
    guest_score: guestScore,
  })
}