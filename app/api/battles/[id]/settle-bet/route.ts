import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminSupabase = createAdminClient()

  const { winner_id } = await request.json()

  const { data: battle } = await adminSupabase
    .from('battles')
    .select('*')
    .eq('id', id)
    .single()

  if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  if (battle.bet_status !== 'matched') return NextResponse.json({ message: 'No active bet' })

  // Validate winner_id is actually a participant in this battle
  if (winner_id !== battle.host_id && winner_id !== battle.guest_id) {
    return NextResponse.json({ error: 'Invalid winner' }, { status: 400 })
  }

  if (!battle.guest_id) {
    return NextResponse.json({ error: 'No opponent in this battle' }, { status: 400 })
  }

  const loser_id = winner_id === battle.host_id ? battle.guest_id : battle.host_id

  const winnerStakedId = winner_id === battle.host_id
    ? battle.host_staked_inventory_id
    : battle.guest_staked_inventory_id

  const loserStakedId = loser_id === battle.host_id
    ? battle.host_staked_inventory_id
    : battle.guest_staked_inventory_id

  // Transfer loser's card to winner
  if (loserStakedId) {
    await adminSupabase
      .from('user_inventory')
      .update({ user_id: winner_id, obtained_via: 'admin_grant' })
      .eq('id', loserStakedId)
  }

  // Mark bet as settled
  await adminSupabase
    .from('battles')
    .update({ bet_status: 'settled' })
    .eq('id', id)

  return NextResponse.json({
    success:       true,
    card_won:      loserStakedId ?? null,
    card_kept:     winnerStakedId ?? null,
  })
}