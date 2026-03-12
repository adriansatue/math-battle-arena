'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Stats {
  total_users:    number
  total_battles:  number
  active_battles: number
  flagged_answers: number
  total_cards:    number
}

export default function AdminPage() {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) { router.push('/lobby'); return }

      // Fetch stats
      const [users, battles, activeBattles, flagged, cards] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('battles').select('id', { count: 'exact', head: true }),
        supabase.from('battles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('battle_answers').select('id', { count: 'exact', head: true }).eq('flagged', true),
        supabase.from('reward_catalog').select('id', { count: 'exact', head: true }),
      ])

      setStats({
        total_users:     users.count    ?? 0,
        total_battles:   battles.count  ?? 0,
        active_battles:  activeBattles.count ?? 0,
        flagged_answers: flagged.count  ?? 0,
        total_cards:     cards.count    ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [router, supabase])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white animate-pulse">Loading admin panel...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">⚙️ Admin Panel</h1>
            <p className="text-gray-400 text-sm mt-1">Math Battle Arena</p>
          </div>
          <Link href="/lobby"
            className="bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            ← Back to Game
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Users',      value: stats?.total_users,     emoji: '👥', color: 'from-blue-600 to-blue-700' },
            { label: 'Total Battles',    value: stats?.total_battles,   emoji: '⚔️', color: 'from-purple-600 to-purple-700' },
            { label: 'Active Battles',   value: stats?.active_battles,  emoji: '🔥', color: 'from-orange-600 to-orange-700' },
            { label: 'Flagged Answers',  value: stats?.flagged_answers, emoji: '🚩', color: 'from-red-600 to-red-700' },
            { label: 'Reward Cards',     value: stats?.total_cards,     emoji: '🃏', color: 'from-green-600 to-green-700' },
          ].map(stat => (
            <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-2xl p-5`}>
              <div className="text-3xl mb-2">{stat.emoji}</div>
              <div className="text-3xl font-bold text-white">{stat.value ?? 0}</div>
              <div className="text-white/70 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Nav cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/admin/cards">
            <div className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/50 rounded-2xl p-6 transition cursor-pointer group">
              <div className="text-4xl mb-3">🃏</div>
              <h2 className="text-white font-bold text-xl mb-1">Manage Cards</h2>
              <p className="text-gray-400 text-sm">Add, edit or remove reward cards from the catalog</p>
              <div className="text-purple-400 text-sm mt-4 group-hover:translate-x-1 transition-transform">
                Manage → 
              </div>
            </div>
          </Link>

          <Link href="/admin/flagged">
            <div className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-red-500/50 rounded-2xl p-6 transition cursor-pointer group">
              <div className="text-4xl mb-3">🚩</div>
              <h2 className="text-white font-bold text-xl mb-1">Flagged Answers</h2>
              <p className="text-gray-400 text-sm">Review suspicious answers flagged by the anti-cheat system</p>
              {stats?.flagged_answers ? (
                <div className="text-red-400 text-sm mt-4 font-semibold">
                  ⚠️ {stats.flagged_answers} answers need review
                </div>
              ) : (
                <div className="text-green-400 text-sm mt-4">✅ No flagged answers</div>
              )}
            </div>
          </Link>

          <Link href="/leaderboard">
            <div className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl p-6 transition cursor-pointer group">
              <div className="text-4xl mb-3">🏆</div>
              <h2 className="text-white font-bold text-xl mb-1">Leaderboard</h2>
              <p className="text-gray-400 text-sm">View all player rankings and stats</p>
              <div className="text-purple-400 text-sm mt-4 group-hover:translate-x-1 transition-transform">
                View →
              </div>
            </div>
          </Link>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 opacity-50">
            <div className="text-4xl mb-3">📊</div>
            <h2 className="text-white font-bold text-xl mb-1">Analytics</h2>
            <p className="text-gray-400 text-sm">Question difficulty stats, category performance</p>
            <div className="text-gray-600 text-sm mt-4">Coming soon</div>
          </div>
        </div>

      </div>
    </div>
  )
}