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

const rarityBadgeColor = {
  common:    'bg-gray-500/30 text-gray-300',
  uncommon:  'bg-green-500/30 text-green-300',
  rare:      'bg-blue-500/30 text-blue-300',
  legendary: 'bg-yellow-500/30 text-yellow-300',
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
  }, [supabase, battleId, isHost])

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

  // Status badge
  const bothStaked  = staked && !!opponentStakedCard
  const mustMatch   = !staked && !!opponentStakedCard
  const awaitingOpp = staked && !opponentStakedCard

  return (
    <div className={`rounded-2xl p-4 border transition-all ${
      mustMatch
        ? 'bg-yellow-500/10 border-yellow-500/40 shadow-lg shadow-yellow-500/10'
        : bothStaked
        ? 'bg-green-500/10 border-green-500/40 shadow-lg shadow-green-500/10'
        : 'bg-white/5 border-white/10'
    }`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-sm">🃏 Card Wager</h3>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border transition-all ${
          bothStaked  ? 'bg-green-500/20 text-green-300 border-green-500/30' :
          awaitingOpp ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse' :
          mustMatch   ? 'bg-red-500/20   text-red-300   border-red-500/30   animate-pulse' :
                        'bg-white/10     text-white/40  border-white/10'
        }`}>
          {bothStaked  ? '✅ Matched — ready!' :
           awaitingOpp ? '⏳ Awaiting opponent' :
           mustMatch   ? '⚠️ Must match to start!' :
                         'Optional'}
        </span>
      </div>

      {/* Duel layout: [Your Stake] [VS] [Opponent's Stake] */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">

        {/* ── Your slot ── */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-white/50 text-xs uppercase tracking-wider">Your Stake</p>

          {staked && selected ? (
            <div className="relative">
              <RewardCard
                name={selected.reward_catalog.name}
                description=""
                rarity={selected.reward_catalog.rarity}
                image_url={selected.reward_catalog.image_url}
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow">
                ✅ Staked
              </div>
            </div>
          ) : (
            <button
              onClick={() => inventory.length > 0 && setShow(true)}
              disabled={inventory.length === 0}
              className={`w-[144px] h-[208px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
                mustMatch
                  ? 'border-yellow-400/70 bg-yellow-500/10 hover:bg-yellow-500/20'
                  : 'border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40'
              }`}
            >
              <div className={`text-3xl ${mustMatch ? 'animate-bounce' : ''}`}>
                {inventory.length === 0 ? '🚫' : mustMatch ? '⚔️' : '+'}
              </div>
              <p className={`text-xs text-center px-2 leading-snug ${mustMatch ? 'text-yellow-300 font-semibold' : 'text-white/40'}`}>
                {inventory.length === 0
                  ? 'No cards yet'
                  : mustMatch
                  ? 'Tap to match!'
                  : 'Stake a card'}
              </p>
            </button>
          )}

          {staked && (
            <button
              onClick={unstakeCard}
              disabled={loading}
              className="text-red-400 hover:text-red-300 text-xs transition mt-1"
            >
              {loading ? 'Removing…' : 'Remove stake'}
            </button>
          )}
        </div>

        {/* ── VS divider ── */}
        <div className="flex items-center justify-center mt-16">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${
            bothStaked
              ? 'bg-green-500/30 border-green-400/50 text-green-300'
              : 'bg-white/10 border-white/20 text-white/40'
          }`}>
            VS
          </div>
        </div>

        {/* ── Opponent's slot ── */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-white/50 text-xs uppercase tracking-wider">Their Stake</p>

          {opponentStakedCard ? (
            <div className="relative">
              <RewardCard
                name={opponentStakedCard.name}
                description=""
                rarity={opponentStakedCard.rarity}
                image_url={opponentStakedCard.image_url}
              />
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow capitalize ${
                rarityBadgeColor[opponentStakedCard.rarity]
              }`}>
                ⚔️ {opponentStakedCard.rarity}
              </div>
            </div>
          ) : (
            <div className="w-[144px] h-[208px] rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-2">
              <div className="text-3xl opacity-20">?</div>
              <p className="text-white/25 text-xs">Awaiting…</p>
            </div>
          )}
        </div>
      </div>

      {/* Winner takes all footer */}
      {(staked || opponentStakedCard) && (
        <p className={`text-center text-xs mt-5 transition-all ${bothStaked ? 'text-green-300/70' : 'text-white/30'}`}>
          🏆 Winner takes both cards
        </p>
      )}

      {/* Card picker modal */}
      {show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-xl">Pick a Card to Stake</h2>
              <button onClick={() => setShow(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Win → you keep yours and take theirs. Lose → they take yours.
            </p>

            <div className="flex flex-wrap gap-3 overflow-y-auto flex-1 justify-center pb-4">
              {sorted.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`cursor-pointer transition-all ${
                    selected?.id === item.id
                      ? 'scale-110 ring-2 ring-purple-400 rounded-2xl'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
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
                {loading ? 'Staking…' : '⚔️ Stake This Card!'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}