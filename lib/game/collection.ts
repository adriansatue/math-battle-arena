export const PACKS = {
  basic: { label: 'Basic Pack', cost: 300 },
  rare: { label: 'Rare Pack', cost: 900 },
  legendary: { label: 'Legendary Pack', cost: 1800 },
} as const

export type PackType = keyof typeof PACKS

export type CollectionSetProgress = {
  set_key: string
  total: number
  owned: number
  completed: boolean
  reward_coins: number
  claimed: boolean
}

export type CollectionProgress = {
  selected_pack_type: PackType
  showcased_inventory_id: string | null
  points_balance: number
  total_cards: number
  unique_cards: number
  duplicates: number
  sets: CollectionSetProgress[]
}

export function packProgress(balance: number, packType: PackType) {
  const cost = PACKS[packType].cost
  return {
    cost,
    remaining: Math.max(0, cost - balance),
    percent: Math.min(100, Math.round(100 * balance / cost)),
  }
}
