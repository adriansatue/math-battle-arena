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

  const { inventory_id } = await request.json().catch(() => ({}))
  if (typeof inventory_id !== 'string' || inventory_id.length === 0) {
    return NextResponse.json({ error: 'inventory_id is required' }, { status: 400 })
  }

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

  const { data: activeStake } = await adminSupabase
    .from('battles')
    .select('id')
    .in('status', ['waiting', 'active'])
    .in('bet_status', ['offered', 'matched'])
    .or(`host_staked_inventory_id.eq.${inventory_id},guest_staked_inventory_id.eq.${inventory_id}`)
    .neq('id', id)
    .limit(1)
    .single()

  if (activeStake) {
    return NextResponse.json({ error: 'Card is already staked in another battle' }, { status: 409 })
  }

  const isHost  = battle.host_id  === user.id
  const isGuest = battle.guest_id === user.id

  if (!isHost && !isGuest) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  const update = isHost
    ? {
        host_staked_inventory_id: inventory_id,
        bet_status: battle.guest_staked_inventory_id ? 'matched' : 'offered',
      }
    : {
        guest_staked_inventory_id: inventory_id,
        bet_status: battle.host_staked_inventory_id ? 'matched' : 'offered',
      }

  const { data: updatedBattle, error: updateError } = await adminSupabase
    .from('battles')
    .update(update)
    .eq('id', id)
    .eq('status', 'waiting')
    .select('id')
    .single()

  if (updateError || !updatedBattle) {
    return NextResponse.json({ error: 'Battle is no longer accepting stakes' }, { status: 409 })
  }

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

  const isHost  = battle.host_id === user.id
  const isGuest = battle.guest_id === user.id

  if (!isHost && !isGuest) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  const update = isHost
    ? { host_staked_inventory_id: null, bet_status: battle.guest_staked_inventory_id ? 'offered' : 'none' }
    : { guest_staked_inventory_id: null, bet_status: battle.host_staked_inventory_id ? 'offered' : 'none' }

  const { data: updatedBattle, error: updateError } = await adminSupabase
    .from('battles')
    .update(update)
    .eq('id', id)
    .eq('status', 'waiting')
    .select('id')
    .single()

  if (updateError || !updatedBattle) {
    return NextResponse.json({ error: 'Battle is no longer accepting stakes' }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
