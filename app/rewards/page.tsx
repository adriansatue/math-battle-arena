'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RewardCard } from '@/components/cards/RewardCard'
import { PackOpener } from '@/components/cards/PackOpener'
import Link from 'next/link'

interface InventoryCard {
  id:          string
  obtained_at: string
  reward_catalog: {
    id:          string
    name:        string
    description: string
    rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
    image_url:   string
  }
}

interface PackCard {
  id:          string
  name:        string
  description: string
  rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
  image_url:   string
}

const PACK_COST = 500

export default function RewardsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [inventory,   setInventory]   = useState<InventoryCard[]>([])
  const [points,      setPoints]      = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [opening,     setOpening]     = useState(false)
  const [packCards,   setPackCards]   = useState<PackCard[]>([])
  const [showPack,    setShowPack]    = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [filter,      setFilter]      = useState<string>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', user.id)
        .single()
      setPoints(profile?.total_points ?? 0)

      const { data: inv } = await supabase
        .from('user_inventory')
        .select(`
          id,
          obtained_at,
          reward_catalog (
            id, name, description, rarity, image_url
          )
        `)
        .eq('user_id', user.id)
        .order('obtained_at', { ascending: false })

      setInventory((inv as unknown as InventoryCard[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function openPack() {
    setOpening(true)
    setError(null)

    const res  = await fetch('/api/rewards/open-pack', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setOpening(false)
      return
    }

    setPackCards(data.cards)
    setPoints(prev => prev - PACK_COST)
    setShowPack(true)
    setOpening(false)
  }

  function handlePackClose() {
    setShowPack(false)
    // Add new cards to inventory display
    setInventory(prev => [
      ...packCards.map((c, i) => ({
        id:          `new-${i}`,
        obtained_at: new Date().toISOString(),
        reward_catalog: c,
      })),
      ...prev,
    ])
  }

  const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 }
  const filtered = inventory.filter(item =>
    filter === 'all' || item.reward_catalog.rarity === filter
  ).sort((a, b) =>
    rarityOrder[a.reward_catalog.rarity] - rarityOrder[b.reward_catalog.rarity]
  )

  const counts = {
    legendary: inventory.filter(i => i.reward_catalog.rarity === 'legendary').length,
    rare:      inventory.filter(i => i.reward_catalog.rarity === 'rare').length,
    uncommon:  inventory.filter(i => i.reward_catalog.rarity === 'uncommon').length,
    common:    inventory.filter(i => i.reward_catalog.rarity === 'common').length,
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse text-xl">Loading collection...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-4xl font-bold text-white mb-2">🃏 Card Collection</h1>
          <p className="text-purple-300">{inventory.length} cards collected</p>
        </div>

        {/* Pack opener */}
        <div className="bg-gradient-to-r from-indigo-600/30 to-purple-600/30 rounded-2xl p-5 border border-purple-500/30 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">🎁 Open a Pack</h2>
              <p className="text-purple-300 text-sm">3 random cards · {PACK_COST} pts</p>
              <p className="text-white/50 text-xs mt-1">Your balance: {points.toLocaleString()} pts</p>
            </div>
            <button
              onClick={openPack}
              disabled={opening || points < PACK_COST}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              {opening ? 'Opening...' : points < PACK_COST ? 'Not enough pts' : 'Open Pack!'}
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm mt-3 bg-red-500/10 rounded-lg p-2">{error}</p>
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

        {/* Filter tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-4 gap-1">
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