'use client'

import { useState } from 'react'
import { RewardCard } from '@/components/cards/RewardCard'
import { PackOpener } from '@/components/cards/PackOpener'
import Link from 'next/link'

interface InventoryCard {
  id:          string
  obtained_at: string
  grade?:      number | null
  reward_catalog: {
    id:          string
    name:        string
    description: string
    rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
    image_url:   string
    generation?: number | null
  }
}

interface PackCard {
  id:          string
  name:        string
  description: string
  rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
  image_url:   string
  generation?: number | null
  grade?:      number
}

interface Props {
  initialInventory: InventoryCard[]
  initialPoints:    number
  totalCards:       number
}

export default function RewardsClient({ initialInventory, initialPoints, totalCards }: Props) {
  const [inventory, setInventory] = useState<InventoryCard[]>(initialInventory)
  const [points,    setPoints]    = useState(initialPoints)
  const [opening,   setOpening]   = useState(false)
  const [packCards, setPackCards] = useState<PackCard[]>([])
  const [showPack,  setShowPack]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [filter,    setFilter]    = useState<string>('all')
  const [gradeFilter, setGradeFilter] = useState<number | null>(null)

  async function openPack(packType: 'basic' | 'rare' | 'legendary' = 'basic') {
    setOpening(true)
    setError(null)

    const res  = await fetch('/api/rewards/open-pack', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pack_type: packType }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setOpening(false)
      return
    }

    setPackCards(data.cards)
    const costs = { basic: 500, rare: 2000, legendary: 5000 }
    setPoints(prev => prev - costs[packType])
    setShowPack(true)
    setOpening(false)
  }

  function handlePackClose() {
    setShowPack(false)
    const ts = Date.now()
    setInventory(prev => [
      ...packCards.map((c, i) => ({
        id:          `new-${ts}-${i}`,
        obtained_at: new Date().toISOString(),
        grade:       c.grade,
        reward_catalog: c,
      })),
      ...prev,
    ])
  }

  const GRADE_LABEL: Record<number, string> = { 10: 'Gem Mint', 9: 'Mint', 8: 'NM-MT', 7: 'Near Mint', 6: 'EX-MT', 5: 'Excellent' }
  const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 }
  const filtered = inventory.filter(item => {
    const rarityOk = filter === 'all' || item.reward_catalog.rarity === filter
    const gradeOk  = gradeFilter === null || item.grade === gradeFilter
    return rarityOk && gradeOk
  }).sort((a, b) =>
    rarityOrder[a.reward_catalog.rarity] - rarityOrder[b.reward_catalog.rarity]
  )

  const counts = {
    legendary: inventory.filter(i => i.reward_catalog.rarity === 'legendary').length,
    rare:      inventory.filter(i => i.reward_catalog.rarity === 'rare').length,
    uncommon:  inventory.filter(i => i.reward_catalog.rarity === 'uncommon').length,
    common:    inventory.filter(i => i.reward_catalog.rarity === 'common').length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-4xl font-bold text-white mb-2">🃏 Card Collection</h1>
          <p className="text-purple-300">{inventory.length} / {totalCards} cards collected</p>
        </div>

        {/* Pack opener */}
        <div className="mb-6 space-y-3">
          <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-50">
            Open a Pack
          </h2>

          {[
            {
              type:      'basic',
              label:     '🥉 Basic Pack',
              cost:      500,
              cards:     '3 cards',
              odds:      'Common & Uncommon',
              color:     'from-gray-500/20 to-gray-600/20',
              border:    'border-gray-500/30',
              btnColor:  'from-gray-400 to-gray-500',
              textColor: 'text-gray-300',
            },
            {
              type:      'rare',
              label:     '🥈 Rare Pack',
              cost:      2000,
              cards:     '3 cards',
              odds:      '1 Rare guaranteed',
              color:     'from-blue-500/20 to-indigo-600/20',
              border:    'border-blue-500/30',
              btnColor:  'from-blue-500 to-indigo-600',
              textColor: 'text-blue-300',
            },
            {
              type:      'legendary',
              label:     '🥇 Legendary Pack',
              cost:      5000,
              cards:     '3 cards',
              odds:      '40% chance of Legendary!',
              color:     'from-yellow-500/20 to-orange-500/20',
              border:    'border-yellow-500/30',
              btnColor:  'from-yellow-500 to-orange-500',
              textColor: 'text-yellow-300',
            },
          ].map(pack => (
            <div
              key={pack.type}
              className={`bg-gradient-to-r ${pack.color} rounded-2xl p-4 border ${pack.border}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-bold text-lg ${pack.textColor}`}>{pack.label}</h3>
                  <p className="text-white/40 text-xs mt-0.5">{pack.cards} · {pack.odds}</p>
                  <p className="text-white/60 text-xs mt-1">
                    Cost: <span className="font-bold text-white">{pack.cost.toLocaleString()} pts</span>
                    <span className="text-white/30 ml-2">· You have: {points.toLocaleString()} pts</span>
                  </p>
                </div>
                <button
                  onClick={() => openPack(pack.type as 'basic' | 'rare' | 'legendary')}
                  disabled={opening || points < pack.cost}
                  className={`bg-gradient-to-r ${pack.btnColor} hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg text-sm whitespace-nowrap`}
                >
                  {opening ? '...' : points < pack.cost ? 'Need more pts' : 'Open!'}
                </button>
              </div>
            </div>
          ))}

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-2">{error}</p>
          )}
        </div>

        {/* Rarity counts */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { key: 'legendary', label: '⭐ Legendary', color: 'text-yellow-400' },
            { key: 'rare',      label: '🔵 Rare',      color: 'text-blue-400'   },
            { key: 'uncommon',  label: '🟢 Uncommon',  color: 'text-green-400'  },
            { key: 'common',    label: '⚪ Common',    color: 'text-gray-400'   },
          ].map(r => (
            <div key={r.key} className="bg-white/5 rounded-xl p-2 text-center">
              <p className={`text-lg font-bold ${r.color}`}>
                {counts[r.key as keyof typeof counts]}
              </p>
              <p className="text-white/40 text-xs">{r.label}</p>
            </div>
          ))}
        </div>

        {/* Rarity filter tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-2 gap-1">
          {['all', 'legendary', 'rare', 'uncommon', 'common'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                filter === f
                  ? 'bg-white/20 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* TAG grade filter tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-4 gap-1">
          <button
            onClick={() => setGradeFilter(null)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              gradeFilter === null ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            All
          </button>
          {[10, 9, 8, 7, 6, 5].map(g => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              title={GRADE_LABEL[g]}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                gradeFilter === g ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Card grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🃏</p>
            <p className="text-white font-bold text-lg mb-2">No cards yet!</p>
            <p className="text-purple-300 text-sm mb-6">
              Win battles and open packs to start your collection!
            </p>
            <Link href="/lobby"
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold px-8 py-3 rounded-xl transition hover:scale-105">
              ⚔️ Play Now
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3 pb-6">
            {filtered.map(item => (
              <RewardCard
                key={item.id}
                name={item.reward_catalog.name}
                description={item.reward_catalog.description}
                rarity={item.reward_catalog.rarity}
                image_url={item.reward_catalog.image_url}
                generation={item.reward_catalog.generation ?? undefined}
                grade={item.grade ?? undefined}
              />
            ))}
          </div>
        )}

        {/* Nav */}
        <div className="flex gap-3 pb-4">
          <Link href="/lobby"
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
            ⚔️ Play
          </Link>
          <Link href="/leaderboard"
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
            🏆 Ranks
          </Link>
          <Link href="/profile"
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 rounded-xl transition text-center">
            👤 Profile
          </Link>
        </div>

      </div>

      {/* Pack opener modal */}
      {showPack && (
        <PackOpener
          cards={packCards}
          onClose={handlePackClose}
        />
      )}
    </div>
  )
}
