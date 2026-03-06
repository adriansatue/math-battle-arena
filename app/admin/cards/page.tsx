'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Card {
  id:          string
  name:        string
  description: string
  rarity:      string
  image_url:   string
  drop_weight: number
  is_active:   boolean
}

const EMPTY_CARD = {
  name: '', description: '', rarity: 'common',
  image_url: '', drop_weight: 10, is_active: true
}

export default function AdminCardsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [cards,   setCards]   = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Card> | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/lobby'); return }

      const { data } = await supabase
        .from('reward_catalog')
        .select('*')
        .order('rarity')
      setCards((data as Card[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function saveCard() {
    if (!editing) return
    setSaving(true)
    setMessage(null)

    if (editing.id) {
      // Update existing
      const { error } = await supabase
        .from('reward_catalog')
        .update({
          name:        editing.name,
          description: editing.description,
          rarity:      editing.rarity,
          image_url:   editing.image_url,
          drop_weight: editing.drop_weight,
          is_active:   editing.is_active,
        })
        .eq('id', editing.id)

      if (!error) {
        setCards(prev => prev.map(c => c.id === editing.id ? { ...c, ...editing } as Card : c))
        setMessage('✅ Card updated!')
        setEditing(null)
      } else {
        setMessage(`❌ ${error.message}`)
      }
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('reward_catalog')
        .insert({
          name:        editing.name,
          description: editing.description,
          rarity:      editing.rarity,
          image_url:   editing.image_url,
          drop_weight: editing.drop_weight,
          is_active:   editing.is_active ?? true,
        })
        .select()
        .single()

      if (!error && data) {
        setCards(prev => [...prev, data as Card])
        setMessage('✅ Card added!')
        setEditing(null)
      } else {
        setMessage(`❌ ${error?.message}`)
      }
    }
    setSaving(false)
  }

  async function toggleActive(card: Card) {
    await supabase
      .from('reward_catalog')
      .update({ is_active: !card.is_active })
      .eq('id', card.id)
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, is_active: !c.is_active } : c))
  }

  const rarityColor: Record<string, string> = {
    common:    'text-gray-400',
    uncommon:  'text-green-400',
    rare:      'text-blue-400',
    legendary: 'text-yellow-400',
  }

  const filtered = filter === 'all' ? cards : cards.filter(c => c.rarity === filter)

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white animate-pulse">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Admin</Link>
            <h1 className="text-2xl font-bold text-white mt-1">🃏 Manage Cards</h1>
          </div>
          <button
            onClick={() => setEditing(EMPTY_CARD)}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl transition"
          >
            + Add Card
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-semibold ${
            message.startsWith('✅') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
          }`}>{message}</div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {['all', 'legendary', 'rare', 'uncommon', 'common'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                filter === f ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {f} {f !== 'all' && `(${cards.filter(c => c.rarity === f).length})`}
            </button>
          ))}
        </div>

        {/* Cards table */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 text-xs p-4">Card</th>
                <th className="text-left text-gray-400 text-xs p-4">Rarity</th>
                <th className="text-left text-gray-400 text-xs p-4">Weight</th>
                <th className="text-left text-gray-400 text-xs p-4">Status</th>
                <th className="text-left text-gray-400 text-xs p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(card => (
                <tr key={card.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {card.image_url && (
                        <img src={card.image_url} alt={card.name}
                          className="w-10 h-10 object-contain rounded-lg bg-white/5 p-1"/>
                      )}
                      <div>
                        <p className="text-white font-semibold text-sm">{card.name}</p>
                        <p className="text-gray-500 text-xs truncate max-w-48">{card.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-sm font-bold capitalize ${rarityColor[card.rarity]}`}>
                      {card.rarity}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-gray-300 text-sm">{card.drop_weight}</span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => toggleActive(card)}
                      className={`text-xs font-bold px-2 py-1 rounded-full transition ${
                        card.is_active
                          ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                          : 'bg-red-500/20 text-red-400 hover:bg-green-500/20 hover:text-green-400'
                      }`}>
                      {card.is_active ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td className="p-4">
                    <button onClick={() => setEditing(card)}
                      className="text-purple-400 hover:text-purple-300 text-xs font-semibold transition">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md">
              <h2 className="text-white font-bold text-xl mb-4">
                {editing.id ? 'Edit Card' : 'Add New Card'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Name</label>
                  <input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"/>
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Description</label>
                  <input value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p!, description: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"/>
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Image URL</label>
                  <input value={editing.image_url ?? ''} onChange={e => setEditing(p => ({ ...p!, image_url: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"/>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Rarity</label>
                    <select value={editing.rarity ?? 'common'} onChange={e => setEditing(p => ({ ...p!, rarity: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Drop Weight</label>
                    <input type="number" min={1} max={100}
                      value={editing.drop_weight ?? 10}
                      onChange={e => setEditing(p => ({ ...p!, drop_weight: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"/>
                  </div>
                </div>

                {editing.image_url && (
                  <div className="flex justify-center bg-gray-800 rounded-xl p-4">
                    <img src={editing.image_url} alt="preview"
                      className="h-24 object-contain"/>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditing(null)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded-xl transition">
                  Cancel
                </button>
                <button onClick={saveCard} disabled={saving}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl transition">
                  {saving ? 'Saving...' : 'Save Card'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}