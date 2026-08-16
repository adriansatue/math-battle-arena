import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RewardsClient from './RewardsClient'
import RewardsAuthPrompt from './RewardsAuthPrompt'
import type { CollectionProgress } from '@/lib/game/collection'

export const dynamic = 'force-dynamic'

type InventoryRow = {
  id:          string
  obtained_at: string
  grade?:       number | null
  reward_catalog: {
    id:          string
    name:        string
    description: string
    rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
    image_url:   string
    generation?: number | null
    set_key?:     string | null
  }
}

export default async function RewardsPage() {
  const supabase = await createClient()
  const admin    = createAdminClient()
  const fetchCatalogNames = () => admin
    .from('reward_catalog')
    .select('name, set_key')
    .eq('is_active', true)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const { data: catalog } = await fetchCatalogNames()
    const totalCards = new Set((catalog ?? []).map(card => card.name.trim().toLowerCase())).size
    return <RewardsAuthPrompt totalCards={totalCards} />
  }

  const [{ data: profile }, { data: inv, error: invError }, { data: catalog }, { data: collection }] = await Promise.all([
    admin
      .from('profiles')
      .select('total_points, points_balance')
      .eq('id', user.id)
      .single(),
    admin
      .from('user_inventory')
      .select(`
        id,
        obtained_at,
        grade,
        reward_catalog (
          id, name, description, rarity, image_url, generation, set_key
        )
      `)
      .eq('user_id', user.id)
      .order('obtained_at', { ascending: false }),
    fetchCatalogNames(),
    admin.rpc('get_collection_progress_v2', { p_user_id: user.id }),
  ])

  if (invError) console.error('[RewardsPage] inv error:', invError.message)
  const totalCards = new Set((catalog ?? []).map(card => card.name.trim().toLowerCase())).size
  const inventory = (inv as unknown as InventoryRow[] | null) ?? []
  const ownedNames = new Set(inventory.map(item => item.reward_catalog.name.trim().toLowerCase()))
  const rpcCollection = collection as CollectionProgress | null
  const setCards = new Map<string, Set<string>>()
  for (const card of catalog ?? []) {
    const setKey = card.set_key ?? 'arena_origins'
    const cards = setCards.get(setKey) ?? new Set<string>()
    cards.add(card.name.trim().toLowerCase())
    setCards.set(setKey, cards)
  }
  const normalizedCollection: CollectionProgress = {
    selected_pack_type: rpcCollection?.selected_pack_type ?? 'basic',
    showcased_inventory_id: rpcCollection?.showcased_inventory_id ?? null,
    points_balance: profile?.points_balance ?? profile?.total_points ?? 0,
    total_cards: totalCards,
    unique_cards: ownedNames.size,
    duplicates: Math.max(0, inventory.length - ownedNames.size),
    sets: Array.from(setCards, ([setKey, cards]) => {
      const existing = rpcCollection?.sets.find(set => set.set_key === setKey)
      const total = Math.min(existing?.total ?? 10, cards.size)
      const owned = Math.min(total, Array.from(cards).filter(name => ownedNames.has(name)).length)
      return {
        set_key: setKey,
        total,
        owned,
        completed: total > 0 && owned === total,
        reward_coins: existing?.reward_coins ?? 500,
        claimed: existing?.claimed ?? false,
      }
    }),
  }

  return (
    <RewardsClient
      initialInventory={inventory}
      initialPoints={profile?.points_balance ?? profile?.total_points ?? 0}
      totalCards={totalCards}
      initialCollection={normalizedCollection}
    />
  )
}
