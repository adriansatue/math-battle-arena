'use client'

import { useState } from 'react'
import { RewardCard } from '@/components/cards/RewardCard'
import { PackOpener } from '@/components/cards/PackOpener'
import Link from 'next/link'
import { PACKS, packProgress, type CollectionProgress, type PackType } from '@/lib/game/collection'

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
  is_duplicate?: boolean
}

interface Props {
  initialInventory: InventoryCard[]
  initialPoints:    number
  totalCards:       number
  initialCollection: CollectionProgress
}

export default function RewardsClient({ initialInventory, initialPoints, totalCards, initialCollection }: Props) {
  const [inventory, setInventory] = useState<InventoryCard[]>(initialInventory)
  const [points,    setPoints]    = useState(initialPoints)
  const [opening,   setOpening]   = useState(false)
  const [packCards, setPackCards] = useState<PackCard[]>([])
  const [showPack,  setShowPack]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [notice,    setNotice]    = useState<string | null>(null)
  const [filter,    setFilter]    = useState<string>('all')
  const [gradeFilter, setGradeFilter] = useState<number | null>(null)
  const [collection, setCollection] = useState(initialCollection)
  const [packRequestId, setPackRequestId] = useState('pack')

  async function openPack(packType: 'basic' | 'rare' | 'legendary' = 'basic') {
    setOpening(true)
    setError(null)
    setNotice(null)

    const requestId = crypto.randomUUID()
    setPackRequestId(requestId)
    const res  = await fetch('/api/rewards/open-pack', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pack_type: packType, request_id: requestId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setOpening(false)
      return
    }

    setPackCards(data.cards)
    const costs = { basic: 300, rare: 900, legendary: 1800 }
    setPoints(prev => typeof data.points_balance === 'number' ? data.points_balance : prev - costs[packType])
    if (data.duplicate_refund > 0) {
      setNotice(`Duplicate refund: +${data.duplicate_refund.toLocaleString()} coins`)
    }
    setShowPack(true)
    setOpening(false)
  }

  function handlePackClose() {
    setShowPack(false)
    setInventory(prev => [
      ...packCards.map((c, i) => ({
        id:          `${packRequestId}-${i}`,
        obtained_at: new Date().toISOString(),
        grade:       c.grade,
        reward_catalog: c,
      })),
      ...prev,
    ])
    void refreshCollection()
  }

  async function refreshCollection() {
    const response = await fetch('/api/collection', { cache: 'no-store' })
    if (response.ok) setCollection(await response.json() as CollectionProgress)
  }

  async function selectPackGoal(packType: PackType) {
    const response = await fetch('/api/collection', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pack_type: packType }),
    })
    if (response.ok) setCollection(current => ({ ...current, selected_pack_type: packType }))
  }

  async function showcaseCard(inventoryId: string) {
    const response = await fetch('/api/collection', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showcased_inventory_id: inventoryId }),
    })
    if (response.ok) setCollection(current => ({ ...current, showcased_inventory_id: inventoryId }))
  }

  async function claimSet(setKey: string) {
    const response = await fetch('/api/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set_key: setKey }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) { setError(data.error ?? 'Could not claim set reward.'); return }
    if (typeof data.claim?.points_balance === 'number') setPoints(data.claim.points_balance)
    await refreshCollection()
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
          <p className="text-purple-300">{collection.unique_cards} / {totalCards} unique cards · {collection.duplicates} duplicates</p>
        </div>

        <section className="mb-6 border border-cyan-300/20 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-white">Next collection goal</h2>
              <p className="text-xs text-white/45">Choose the pack you are saving coins for.</p>
            </div>
            <span className="text-sm font-black text-cyan-300">{points.toLocaleString()} coins</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 bg-white/5 p-1">
            {(Object.keys(PACKS) as PackType[]).map(packType => (
              <button key={packType} type="button" onClick={() => selectPackGoal(packType)}
                className={`px-2 py-2 text-xs font-bold ${collection.selected_pack_type === packType ? 'bg-cyan-300 text-slate-950' : 'text-white/50 hover:bg-white/10'}`}>
                {PACKS[packType].label}
              </button>
            ))}
          </div>
          {(() => {
            const goal = packProgress(points, collection.selected_pack_type)
            return <div className="mt-3">
              <div className="flex justify-between text-xs text-white/50"><span>{goal.percent}% funded</span><span>{goal.remaining === 0 ? 'Ready to open' : `${goal.remaining.toLocaleString()} coins to go`}</span></div>
              <div className="mt-1 h-2 overflow-hidden bg-white/10"><div className="h-full bg-cyan-300" style={{ width: `${goal.percent}%` }} /></div>
            </div>
          })()}
          {collection.sets.map(set => (
            <div key={set.set_key} className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div><p className="text-sm font-bold capitalize text-white">{set.set_key.replaceAll('_', ' ')}</p><p className="text-xs text-white/40">Set progress {set.owned}/{set.total}</p></div>
              {set.completed && !set.claimed ? <button type="button" onClick={() => claimSet(set.set_key)} className="bg-amber-300 px-3 py-2 text-xs font-black text-slate-950">Claim +{set.reward_coins}</button> : <span className="text-xs font-bold text-white/40">{set.claimed ? 'Reward claimed' : `${set.total - set.owned} remaining`}</span>}
            </div>
          ))}
        </section>

        {/* Pack opener */}
        <div className="mb-6 space-y-3">
          <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-50">
            Open a Pack
          </h2>

          {[
            {
              type:      'basic',
              label:     'Basic Pack',
              cost:      300,
              cards:     '3 cards',
              odds:      'Common & Uncommon',
              color:     'from-gray-500/20 to-gray-600/20',
              border:    'border-gray-500/30',
              btnColor:  'from-gray-400 to-gray-500',
              textColor: 'text-gray-300',
            },
            {
              type:      'rare',
              label:     'Rare Pack',
              cost:      900,
              cards:     '3 cards',
              odds:      '1 Rare guaranteed',
              color:     'from-blue-500/20 to-indigo-600/20',
              border:    'border-blue-500/30',
              btnColor:  'from-blue-500 to-indigo-600',
              textColor: 'text-blue-300',
            },
            {
              type:      'legendary',
              label:     'Legendary Pack',
              cost:      1800,
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
                  <p className="text-white/40 text-xs mt-0.5">{pack.cards} - {pack.odds}</p>
                  <p className="text-white/60 text-xs mt-1">
                    Cost: <span className="font-bold text-white">{pack.cost.toLocaleString()} coins</span>
                    <span className="text-white/30 ml-2">- You have: {points.toLocaleString()} coins</span>
                  </p>
                </div>
                <button
                  onClick={() => openPack(pack.type as 'basic' | 'rare' | 'legendary')}
                  disabled={opening || points < pack.cost}
                  className={`bg-gradient-to-r ${pack.btnColor} hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg text-sm whitespace-nowrap`}
                >
                  {opening ? '...' : points < pack.cost ? 'Need coins' : 'Open!'}
                </button>
              </div>
            </div>
          ))}

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-2">{error}</p>
          )}
          {notice && (
            <p className="text-emerald-300 text-sm bg-emerald-500/10 rounded-lg p-2">{notice}</p>
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
              <div key={item.id} className="text-center">
                <RewardCard
                  name={item.reward_catalog.name}
                  description={item.reward_catalog.description}
                  rarity={item.reward_catalog.rarity}
                  image_url={item.reward_catalog.image_url}
                  generation={item.reward_catalog.generation ?? undefined}
                  grade={item.grade ?? undefined}
                />
                <button type="button" onClick={() => showcaseCard(item.id)} className={`mt-2 text-xs font-bold ${collection.showcased_inventory_id === item.id ? 'text-cyan-300' : 'text-white/35 hover:text-white'}`}>
                  {collection.showcased_inventory_id === item.id ? 'Showcased' : 'Set as showcase'}
                </button>
              </div>
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
