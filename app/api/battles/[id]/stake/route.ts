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

  const { inventory_id } = await request.json()

  // Fetch battle
  const { data: battle } = await adminSupabase
    .from('battles')
    .select('*')
    .eq('id', id)
    .single()

  if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  if (battle.status !== 'waiting') return NextResponse.json({ error: 'Battle already started' }, { status: 400 })

  // Verify card belongs to user
  const { data: item } = await adminSupabase
    .from('user_inventory')
    .select('id, user_id')
    .eq('id', inventory_id)
    .eq('user_id', user.id)
    .single()

  if (!item) return NextResponse.json({ error: 'Card not found in your collection' }, { status: 404 })

  const isHost  = battle.host_id  === user.id
  const isGuest = battle.guest_id === user.id

  if (!isHost && !isGuest) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  const update = isHost
    ? { host_staked_inventory_id: inventory_id, bet_status: 'offered' }
    : { guest_staked_inventory_id: inventory_id, bet_status: 'matched' }

  await adminSupabase
    .from('battles')
    .update(update)
    .eq('id', id)

  return NextResponse.json({ success: true })
}

// Unstake a card
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: battle } = await adminSupabase
    .from('battles').select('*').eq('id', id).single()

  if (!battle || battle.status !== 'waiting') {
    return NextResponse.json({ error: 'Cannot unstake' }, { status: 400 })
  }

  const isHost = battle.host_id === user.id
  const update = isHost
    ? { host_staked_inventory_id: null, bet_status: 'none' }
    : { guest_staked_inventory_id: null, bet_status: battle.host_staked_inventory_id ? 'offered' : 'none' }

  await adminSupabase.from('battles').update(update).eq('id', id)

  return NextResponse.json({ success: true })
}