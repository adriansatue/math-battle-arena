'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RewardCard } from '@/components/cards/RewardCard'

export interface InventoryItem {
  id: string
  reward_catalog: {
    id:          string
    name:        string
    description: string
    rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
    image_url:   string
  }
}

interface CardStakeSelectorProps {
  battleId:        string
  isHost:          boolean
  opponentStakedCard?: {
    name:      string
    rarity:    'common' | 'uncommon' | 'rare' | 'legendary'
    image_url: string
  } | null
  onStaked:  (item: InventoryItem | null) => void
}

export function CardStakeSelector({
  battleId, isHost, opponentStakedCard, onStaked
}: CardStakeSelectorProps) {
  const supabase = createClient()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selected,  setSelected]  = useState<InventoryItem | null>(null)
  const [staked,    setStaked]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [show,      setShow]      = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_inventory')
        .select(`id, reward_catalog(id, name, description, rarity, image_url)`)
        .eq('user_id', user.id)
        .order('obtained_at', { ascending: false })

      setInventory((data as unknown as InventoryItem[]) ?? [])
    }
    load()
  }, [supabase])

  async function stakeCard() {
    if (!selected) return
    setLoading(true)

    const res = await fetch(`/api/battles/${battleId}/stake`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ inventory_id: selected.id }),
    })

    if (res.ok) {
      setStaked(true)
      setShow(false)
      onStaked(selected)
    }
    setLoading(false)
  }

  async function unstakeCard() {
    setLoading(true)
    await fetch(`/api/battles/${battleId}/stake`, { method: 'DELETE' })
    setStaked(false)
    setSelected(null)
    onStaked(null)
    setLoading(false)
  }

  const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 }
  const sorted = [...inventory].sort((a, b) =>
    rarityOrder[a.reward_catalog.rarity] - rarityOrder[b.reward_catalog.rarity]
  )

  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
      <h3 className="text-white font-bold text-sm mb-3">🃏 Card Bet <span className="text-white/40 font-normal">(optional)</span></h3>

      {/* Opponent's staked card */}
      {opponentStakedCard && (
        <div className="mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
          <p className="text-yellow-300 text-xs font-semibold mb-2">
            ⚔️ Opponent staked a card! Stake yours to match the bet.
          </p>
          <div className="flex items-center gap-3">
            <RewardCard
              name={opponentStakedCard.name}
              description=""
              rarity={opponentStakedCard.rarity}
              image_url={opponentStakedCard.image_url}
            />
            <div>
              <p className="text-white font-bold">{opponentStakedCard.name}</p>
              <p className="text-white/40 text-xs capitalize">{opponentStakedCard.rarity}</p>
            </div>
          </div>
        </div>
      )}

      {/* Staked card display */}
      {staked && selected ? (
        <div className="flex items-center gap-3">
          <RewardCard
            name={selected.reward_catalog.name}
            description=""
            rarity={selected.reward_catalog.rarity}
            image_url={selected.reward_catalog.image_url}
          />
          <div className="flex-1">
            <p className="text-white font-bold">{selected.reward_catalog.name}</p>
            <p className="text-green-400 text-xs">✅ Staked for this battle</p>
            <p className="text-white/40 text-xs mt-1">Winner takes this card!</p>
            <button
              onClick={unstakeCard}
              disabled={loading}
              className="text-red-400 hover:text-red-300 text-xs mt-2 transition"
            >
              Remove stake
            </button>
          </div>
        </div>
      ) : (
        <>
          {inventory.length === 0 ? (
            <p className="text-white/30 text-sm">
              No cards yet — win battles and open packs to get cards!
            </p>
          ) : (
            <button
              onClick={() => setShow(true)}
              className="w-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30 border border-yellow-500/30 text-yellow-300 font-bold py-3 rounded-xl transition text-sm"
            >
              🃏 Stake a Card to Win
            </button>
          )}
        </>
      )}

      {/* Card picker modal */}
      {show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-xl">Pick a Card to Stake</h2>
              <button onClick={() => setShow(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              If you win, you keep your card and take your opponents. If you lose, your opponent takes this card!
            </p>

            <div className="flex flex-wrap gap-3 overflow-y-auto flex-1 justify-center pb-4">
              {sorted.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`cursor-pointer transition-all ${
                    selected?.id === item.id ? 'scale-110 ring-2 ring-purple-400 rounded-2xl' : 'hover:scale-105'
                  }`}
                >
                  <RewardCard
                    name={item.reward_catalog.name}
                    description={item.reward_catalog.description}
                    rarity={item.reward_catalog.rarity}
                    image_url={item.reward_catalog.image_url}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShow(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={stakeCard}
                disabled={!selected || loading}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition"
              >
                {loading ? 'Staking...' : '⚔️ Stake This Card!'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}