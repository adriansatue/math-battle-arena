import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PACK_COST = 500

export async function POST() {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get profile
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('total_points')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (profile.total_points < PACK_COST) {
    return NextResponse.json({
      error: `Not enough points! You need ${PACK_COST} pts to open a pack.`
    }, { status: 400 })
  }

  // Get active reward catalog
  const { data: catalog } = await adminSupabase
    .from('reward_catalog')
    .select('*')
    .eq('is_active', true)

  if (!catalog || catalog.length === 0) {
    return NextResponse.json({ error: 'No rewards available' }, { status: 404 })
  }

  // Weighted random draw — pick 3 cards
  function weightedPick() {
    const totalWeight = catalog!.reduce((sum, r) => sum + r.drop_weight, 0)
    let rand = Math.random() * totalWeight
    for (const reward of catalog!) {
      rand -= reward.drop_weight
      if (rand <= 0) return reward
    }
    return catalog![0]
  }

  const picked = [weightedPick(), weightedPick(), weightedPick()]

  // Deduct points
  await adminSupabase
    .from('profiles')
    .update({ total_points: profile.total_points - PACK_COST })
    .eq('id', user.id)

  // Add cards to inventory
  await adminSupabase
    .from('user_inventory')
    .insert(picked.map(card => ({
      user_id:      user.id,
      reward_id:    card.id,
      obtained_via: 'pack_reward',
    })))

  return NextResponse.json({
    cards: picked.map(c => ({
      id:          c.id,
      name:        c.name,
      description: c.description,
      rarity:      c.rarity,
      image_url:   c.image_url,
    }))
  })
}