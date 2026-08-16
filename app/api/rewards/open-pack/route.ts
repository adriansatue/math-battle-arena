import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordServerEvent } from '@/lib/events/server'
import { PACKS, type PackType } from '@/lib/game/collection'

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

  const body = await request.json().catch(() => ({})) as { pack_type?: PackType; request_id?: string }
  const pack_type: PackType = body.pack_type ?? 'basic'
  const config  = PACK_CONFIG[pack_type]
  const weights = WEIGHTS[pack_type]

  if (!config) return NextResponse.json({ error: 'Invalid pack type' }, { status: 400 })
  if (!body.request_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 })
  }

  // Get eligible catalog cards
  const { data: catalog } = await adminSupabase
    .from('reward_catalog')
    .select('*')
    .eq('is_active', true)
    .in('rarity', config.allowedRarities)

  const cards = Array.from(new Map(
    ((catalog ?? []) as CatalogCard[]).map(card => [card.name.trim().toLowerCase(), card])
  ).values())

  if (cards.length === 0) {
    return NextResponse.json({ error: 'No rewards available' }, { status: 404 })
  }

  const { data: ownedInventory } = await adminSupabase
    .from('user_inventory')
    .select('reward_id, reward_catalog(name)')
    .eq('user_id', user.id)

  const ownedCardNames = new Set(
    (ownedInventory ?? [])
      .map(item => (item as unknown as { reward_catalog?: { name?: string } | null }).reward_catalog?.name?.trim().toLowerCase())
      .filter((name): name is string => Boolean(name))
  )

  function weightedPick(forceMinRarity?: Rarity, excludeIds = new Set<string>()): CatalogCard {
    let pool = cards

    // Force minimum rarity if needed
    if (forceMinRarity) {
      const minIdx = RARITY_ORDER.indexOf(forceMinRarity)
      const elevated = pool.filter(c => RARITY_ORDER.indexOf(c.rarity) >= minIdx)
      if (elevated.length > 0) pool = elevated
    }

    const unownedPool = pool.filter(c => !ownedCardNames.has(c.name.trim().toLowerCase()) && !excludeIds.has(c.id))
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
  const { data: receiptData, error: settleError } = await adminSupabase.rpc('settle_pack_opening', {
    p_request_id: body.request_id,
    p_user_id: user.id,
    p_pack_type: pack_type,
    p_reward_ids: picks.map(card => card.id),
    p_grades: grades,
  })
  if (settleError || !receiptData) {
    const insufficient = settleError?.message.includes('insufficient coins')
    return NextResponse.json({
      error: insufficient ? `Not enough coins. You need ${PACKS[pack_type].cost.toLocaleString()} coins to open this pack.` : 'Could not open this pack. Please try again.',
    }, { status: insufficient ? 400 : 409 })
  }
  const receipt = receiptData as {
    reward_ids: string[]
    grades: number[]
    duplicate_count: number
    duplicate_reward_ids?: string[]
    duplicate_refund: number
    net_cost: number
    points_balance: number
  }
  const returnedCards = receipt.reward_ids.map(rewardId => cards.find(card => card.id === rewardId)).filter((card): card is CatalogCard => Boolean(card))
  if (returnedCards.length !== 3) return NextResponse.json({ error: 'Pack receipt is invalid' }, { status: 500 })

  await recordServerEvent({
    userId: user.id,
    eventName: 'pack_opened',
    dedupKey: `pack:${body.request_id}`,
    properties: {
      pack_type,
      cost: config.cost,
      net_cost: receipt.net_cost,
      duplicate_count: receipt.duplicate_count,
      duplicate_refund: receipt.duplicate_refund,
      legendary_count: returnedCards.filter(card => card.rarity === 'legendary').length,
    },
  })

  return NextResponse.json({
    cards: returnedCards.map((c, i) => ({
      id:          c.id,
      name:        c.name,
      description: c.description,
      rarity:      c.rarity,
      image_url:   c.image_url,
      generation:  c.generation ?? null,
      grade:       receipt.grades[i],
      is_duplicate: receipt.duplicate_reward_ids?.length
        ? receipt.duplicate_reward_ids.includes(c.id)
        : ownedCardNames.has(c.name.trim().toLowerCase()),
    })),
    duplicate_refund: receipt.duplicate_refund,
    net_cost:         receipt.net_cost,
    points_balance:   receipt.points_balance,
  })
}
