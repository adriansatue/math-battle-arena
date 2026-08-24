'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  const supabase = useMemo(() => createClient(), [])

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

    const payload = {
      name:        editing.name,
      description: editing.description,
      rarity:      editing.rarity,
      image_url:   editing.image_url,
      drop_weight: editing.drop_weight,
      is_active:   editing.is_active ?? true,
    }

    if (editing.id) {
      const res = await fetch(`/api/admin/cards/${editing.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()

      if (res.ok && data.card) {
        setCards(prev => prev.map(c => c.id === editing.id ? data.card as Card : c))
        setMessage('OK: Card updated.')
        setEditing(null)
      } else {
        setMessage(`Error: ${data.error ?? 'Failed to update card'}`)
      }
    } else {
      const res = await fetch('/api/admin/cards', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()

      if (res.ok && data.card) {
        setCards(prev => [...prev, data.card as Card])
        setMessage('OK: Card added.')
        setEditing(null)
      } else {
        setMessage(`Error: ${data.error ?? 'Failed to add card'}`)
      }
    }
    setSaving(false)
  }

  async function toggleActive(card: Card) {
    if (card.is_active && !window.confirm(`La carta "${card.name}" dejará de estar disponible en nuevos sobres. ¿Continuar?`)) return
    const res = await fetch(`/api/admin/cards/${card.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !card.is_active }),
    })
    const data = await res.json()

    if (res.ok && data.card) {
      setCards(prev => prev.map(c => c.id === card.id ? data.card as Card : c))
    } else {
      setMessage(`Error: ${data.error ?? 'No se pudo actualizar la carta'}`)
    }
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
      <div className="text-white animate-pulse">Cargando catálogo...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">Volver al panel</Link>
            <h1 className="text-2xl font-bold text-white mt-1">Gestionar cartas</h1>
          </div>
          <button
            onClick={() => setEditing(EMPTY_CARD)}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl transition"
          >
            Añadir carta
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-semibold ${
            message.startsWith('OK:') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
          }`}>{message}</div>
        )}

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {['all', 'legendary', 'rare', 'uncommon', 'common'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                filter === f ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {f === 'all' ? 'Todas' : f} {f !== 'all' && `(${cards.filter(c => c.rarity === f).length})`}
            </button>
          ))}
        </div>

        <div className="hidden bg-gray-900 rounded-2xl border border-gray-800 overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 text-xs p-4">Carta</th>
                <th className="text-left text-gray-400 text-xs p-4">Rareza</th>
                <th className="text-left text-gray-400 text-xs p-4">Peso</th>
                <th className="text-left text-gray-400 text-xs p-4">Estado</th>
                <th className="text-left text-gray-400 text-xs p-4">Acciones</th>
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
                      {card.is_active ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="p-4">
                    <button onClick={() => setEditing(card)}
                      className="text-purple-400 hover:text-purple-300 text-xs font-semibold transition">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {filtered.map(card => (
            <article key={card.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-start gap-3">
                {card.image_url && <img src={card.image_url} alt={card.name} className="h-14 w-14 shrink-0 rounded-lg bg-white/5 object-contain p-1" />}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{card.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{card.description}</p>
                  <p className={`mt-2 text-xs font-bold capitalize ${rarityColor[card.rarity]}`}>{card.rarity} · peso {card.drop_weight}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => void toggleActive(card)} className={`rounded-lg px-3 py-2 text-sm font-bold ${card.is_active ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                  {card.is_active ? 'Activa' : 'Inactiva'}
                </button>
                <button onClick={() => setEditing(card)} className="rounded-lg bg-purple-500/15 px-3 py-2 text-sm font-bold text-purple-300">Editar</button>
              </div>
            </article>
          ))}
        </div>

        {editing && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md">
              <h2 className="text-white font-bold text-xl mb-4">
                {editing.id ? 'Editar carta' : 'Añadir carta'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
                  <input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"/>
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Descripción</label>
                  <input value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p!, description: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"/>
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">URL de imagen</label>
                  <input value={editing.image_url ?? ''} onChange={e => setEditing(p => ({ ...p!, image_url: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"/>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Rareza</label>
                    <select value={editing.rarity ?? 'common'} onChange={e => setEditing(p => ({ ...p!, rarity: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Peso de aparición</label>
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
                  Cancelar
                </button>
                <button onClick={saveCard} disabled={saving}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl transition">
                  {saving ? 'Guardando...' : 'Guardar carta'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
