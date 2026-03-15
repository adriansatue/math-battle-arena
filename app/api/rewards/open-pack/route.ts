import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PackType = 'basic' | 'rare' | 'legendary'

const PACK_CONFIG = {
  basic: {
    cost:        500,
    label:       '🥉 Basic Pack',
    allowedRarities: ['common', 'uncommon'],
    guaranteed:  null,
  },
  rare: {
    cost:        2000,
    label:       '🥈 Rare Pack',
    allowedRarities: ['uncommon', 'rare', 'legendary'],
    guaranteed:  'rare', // at least 1 rare
  },
  legendary: {
    cost:        5000,
    label:       '🥇 Legendary Pack',
    allowedRarities: ['rare', 'legendary'],
    guaranteed:  'rare',
  },
}

// Drop weights per rarity per pack
const WEIGHTS: Record<PackType, Record<string, number>> = {
  basic: {
    common:    70,
    uncommon:  30,
    rare:       0,
    legendary:  0,
  },
  rare: {
    common:     0,
    uncommon:  50,
    rare:      45,
    legendary:  5,
  },
  legendary: {
    common:     0,
    uncommon:   0,
    rare:      60,
    legendary: 40,
  },
}

// TAG Grading Scale: 5 (Excellent) → 10 (Gem Mint)
// https://taggrading.com/pages/scale
const GRADE_WEIGHTS: [number, number][] = [
  [10, 1],   // 1%  — Gem Mint
  [9,  8],   // 8%  — Mint
  [8,  16],  // 16% — Near Mint-Mint
  [7,  25],  // 25% — Near Mint
  [6,  30],  // 30% — Excellent-Mint
  [5,  20],  // 20% — Excellent
]

function rollGrade(): number {
  const total = GRADE_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let rand = Math.random() * total
  for (const [grade, weight] of GRADE_WEIGHTS) {
    rand -= weight
    if (rand <= 0) return grade
  }
  return 5
}

export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { pack_type?: PackType }
  const pack_type: PackType = body.pack_type ?? 'basic'
  const config  = PACK_CONFIG[pack_type]
  const weights = WEIGHTS[pack_type]

  if (!config) return NextResponse.json({ error: 'Invalid pack type' }, { status: 400 })

  // Check balance
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('total_points, points_balance')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const spendable = profile.points_balance ?? profile.total_points
  if (spendable < config.cost) {
    return NextResponse.json({
      error: `Not enough points! You need ${config.cost.toLocaleString()} pts to open this pack.`
    }, { status: 400 })
  }

  // Get eligible catalog cards
  const { data: catalog } = await adminSupabase
    .from('reward_catalog')
    .select('*')
    .eq('is_active', true)
    .in('rarity', config.allowedRarities)

  if (!catalog || catalog.length === 0) {
    return NextResponse.json({ error: 'No rewards available' }, { status: 404 })
  }

  function weightedPick(forceMinRarity?: string) {
    let pool = catalog!

    // Force minimum rarity if needed
    if (forceMinRarity) {
      const rarityOrder = ['common', 'uncommon', 'rare', 'legendary']
      const minIdx = rarityOrder.indexOf(forceMinRarity)
      const elevated = pool.filter(c => rarityOrder.indexOf(c.rarity) >= minIdx)
      if (elevated.length > 0) pool = elevated
    }

    const totalWeight = pool.reduce((sum, r) => sum + (weights[r.rarity] ?? 1), 0)
    let rand = Math.random() * totalWeight
    for (const reward of pool) {
      rand -= weights[reward.rarity] ?? 1
      if (rand <= 0) return reward
    }
    return pool[0]
  }

  // Pick 3 cards — first card guaranteed minimum rarity for rare/legendary packs
  const picks = [
    config.guaranteed ? weightedPick(config.guaranteed) : weightedPick(),
    weightedPick(),
    weightedPick(),
  ]

  // Assign a TAG grade (5–10) to each card
  const grades = picks.map(() => rollGrade())

  // Deduct cost from spendable balance only (total_points stays as lifetime earned)
  await adminSupabase
    .from('profiles')
    .update({ points_balance: (profile.points_balance ?? profile.total_points) - config.cost })
    .eq('id', user.id)

  // Add to inventory
  const { error: insertError } = await adminSupabase
    .from('user_inventory')
    .insert(picks.map((card, i) => ({
      user_id:      user.id,
      reward_id:    card.id,
      obtained_at:  new Date().toISOString(),
      obtained_via: 'pack_reward',
      grade:        grades[i],
    })))

  if (insertError) {
    console.error('[open-pack] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save cards: ' + insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    cards: picks.map((c, i) => ({
      id:          c.id,
      name:        c.name,
      description: c.description,
      rarity:      c.rarity,
      image_url:   c.image_url,
      generation:  c.generation ?? null,
      grade:       grades[i],
    }))
  })
}