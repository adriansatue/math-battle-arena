import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PackType = 'basic' | 'rare' | 'legendary'
type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

type CatalogCard = {
  id: string
  name: string
  description: string
  rarity: Rarity
  image_url: string
  generation?: number | null
}

const PACK_CONFIG: Record<PackType, {
  cost: number
  label: string
  allowedRarities: Rarity[]
  guaranteed: Rarity | null
}> = {
  basic: {
    cost:        300,
    label:       'Basic Pack',
    allowedRarities: ['common', 'uncommon'],
    guaranteed:  null,
  },
  rare: {
    cost:        900,
    label:       'Rare Pack',
    allowedRarities: ['uncommon', 'rare', 'legendary'],
    guaranteed:  'rare', // at least 1 rare
  },
  legendary: {
    cost:        1800,
    label:       'Legendary Pack',
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

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary']
const DUPLICATE_REFUND: Record<Rarity, number> = {
  common:    25,
  uncommon:  60,
  rare:      150,
  legendary: 400,
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
      error: `Not enough coins. You need ${config.cost.toLocaleString()} coins to open this pack.`
    }, { status: 400 })
  }

  // Get eligible catalog cards
  const { data: catalog } = await adminSupabase
    .from('reward_catalog')
    .select('*')
    .eq('is_active', true)
    .in('rarity', config.allowedRarities)

  const cards = (catalog ?? []) as CatalogCard[]

  if (cards.length === 0) {
    return NextResponse.json({ error: 'No rewards available' }, { status: 404 })
  }

  const { data: ownedInventory } = await adminSupabase
    .from('user_inventory')
    .select('reward_id')
    .eq('user_id', user.id)

  const ownedRewardIds = new Set(
    (ownedInventory ?? [])
      .map(item => (item as { reward_id?: string | null }).reward_id)
      .filter((id): id is string => Boolean(id))
  )

  function weightedPick(forceMinRarity?: Rarity, excludeIds = new Set<string>()): CatalogCard {
    let pool = cards

    // Force minimum rarity if needed
    if (forceMinRarity) {
      const minIdx = RARITY_ORDER.indexOf(forceMinRarity)
      const elevated = pool.filter(c => RARITY_ORDER.indexOf(c.rarity) >= minIdx)
      if (elevated.length > 0) pool = elevated
    }

    const unownedPool = pool.filter(c => !ownedRewardIds.has(c.id) && !excludeIds.has(c.id))
    const freshPool = pool.filter(c => !excludeIds.has(c.id))
    if (unownedPool.length > 0) {
      pool = unownedPool
    } else if (freshPool.length > 0) {
      pool = freshPool
    }

    const totalWeight = pool.reduce((sum, r) => sum + (weights[r.rarity] ?? 1), 0)
    let rand = Math.random() * totalWeight
    for (const reward of pool) {
      rand -= weights[reward.rarity] ?? 1
      if (rand <= 0) return reward
    }
    const fallback = pool[0]
    if (!fallback) throw new Error('No rewards available')
    return fallback
  }

  // Pick 3 cards - first card guaranteed minimum rarity for rare/legendary packs
  const pickedIds = new Set<string>()
  const firstPick = config.guaranteed
    ? weightedPick(config.guaranteed, pickedIds)
    : weightedPick(undefined, pickedIds)
  const picks: CatalogCard[] = [firstPick]
  pickedIds.add(picks[0].id)
  while (picks.length < 3) {
    const nextPick = weightedPick(undefined, pickedIds)
    picks.push(nextPick)
    pickedIds.add(nextPick.id)
  }

  // Assign a TAG grade (5-10) to each card
  const grades = picks.map(() => rollGrade())
  const duplicateRefund = picks.reduce(
    (sum, card) => sum + (ownedRewardIds.has(card.id) ? DUPLICATE_REFUND[card.rarity] : 0),
    0
  )
  const netCost = Math.max(0, config.cost - duplicateRefund)

  const newBalance = spendable - netCost

  // Deduct cost from spendable balance only (total_points stays as lifetime earned).
  // The balance equality check prevents parallel pack-open requests from spending
  // the same points twice.
  const { data: chargedProfile, error: chargeError } = await adminSupabase
    .from('profiles')
    .update({ points_balance: newBalance })
    .eq('id', user.id)
    .eq('points_balance', spendable)
    .select('points_balance')
    .single()

  if (chargeError || !chargedProfile) {
    return NextResponse.json({
      error: 'Your points balance changed. Please try opening the pack again.'
    }, { status: 409 })
  }

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
    // Roll back the points deduction so the user isn't charged for a failed pack
    await adminSupabase
      .from('profiles')
      .update({ points_balance: spendable })
      .eq('id', user.id)
      .eq('points_balance', newBalance)
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
      is_duplicate: ownedRewardIds.has(c.id),
    })),
    duplicate_refund: duplicateRefund,
    net_cost:         netCost,
    points_balance:   newBalance,
  })
}
