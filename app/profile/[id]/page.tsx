'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logout } from '@/lib/supabase/actions'

interface Profile {
  id:             string
  username:       string
  total_points:   number
  level:          number
  rank_title:     string
  wins:           number
  losses:         number
  current_streak: number
  best_streak:    number
  created_at:     string
}

interface Weakness {
  category:      string
  accuracy_rate: number
  total_attempts: number
  avg_speed_ms:  number
}

const LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 7000, 12000, 20000, 35000]

const categoryEmoji: Record<string, string> = {
  addition:        '➕',
  subtraction:     '➖',
  multiplication:  '✖️',
  division:        '➗',
  fractions:       '½',
  order_of_ops:    '🔢',
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params)
  const router   = useRouter()
  const supabase = createClient()

  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([])
  const [isMe,       setIsMe]       = useState(false)
  const [email,      setEmail]      = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setIsMe(user.id === id)
      if (user.id === id) setEmail(user.email ?? null)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (!prof) { router.push('/leaderboard'); return }
      setProfile(prof as Profile)

      if (user.id === id) {
        const { data: w } = await supabase
          .from('student_weaknesses')
          .select('*')
          .eq('user_id', id)
          .order('accuracy_rate', { ascending: true })
        setWeaknesses((w as Weakness[]) ?? [])
      }

      setLoading(false)
    }
    load()
  }, [id, router, supabase])

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse text-xl">Loading profile...</div>
    </div>
  )

  if (!profile) return null

  const winRate = profile.wins + profile.losses > 0
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
    : 0

  // XP progress to next level
  const currentThreshold = LEVEL_THRESHOLDS[profile.level - 1] ?? 0
  const nextThreshold    = LEVEL_THRESHOLDS[profile.level] ?? LEVEL_THRESHOLDS[7]
  const xpProgress       = profile.level >= 8 ? 100 : Math.round(
    ((profile.total_points - currentThreshold) / (nextThreshold - currentThreshold)) * 100
  )

  const levelColor =
    profile.level >= 8 ? 'from-yellow-500 to-orange-500' :
    profile.level >= 6 ? 'from-purple-500 to-pink-500'   :
    profile.level >= 4 ? 'from-blue-500 to-cyan-500'     :
    profile.level >= 2 ? 'from-green-500 to-teal-500'    :
                         'from-gray-500 to-gray-600'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="max-w-lg mx-auto space-y-4 pt-4">

        {/* Profile card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${levelColor} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
              <p className={`text-sm font-semibold bg-gradient-to-r ${levelColor} bg-clip-text text-transparent`}>
                Level {profile.level} · {profile.rank_title}
              </p>
              {isMe && email && (
                <p className="text-white/40 text-xs mt-0.5">
                  ✉️ {email}
                </p>
              )}
              <p className="text-white/30 text-xs mt-0.5">
                🗓️ Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            {isMe && (
              <button
                onClick={() => logout()}
                className="text-white/40 hover:text-white/70 text-xs transition"
              >
                Sign out
              </button>
            )}
          </div>

          {/* XP bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-purple-300 mb-1">
              <span>{profile.total_points.toLocaleString()} pts</span>
              {profile.level < 8 && (
                <span>{nextThreshold.toLocaleString()} pts to next level</span>
              )}
              {profile.level >= 8 && <span>🌟 Max Level!</span>}
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${levelColor} transition-all duration-1000`}
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Wins',       value: profile.wins,           emoji: '🏆' },
              { label: 'Losses',     value: profile.losses,         emoji: '💪' },
              { label: 'Win Rate',   value: `${winRate}%`,          emoji: '📊' },
              { label: 'Best Streak',value: profile.best_streak,    emoji: '🔥' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-lg">{stat.emoji}</div>
                <div className="text-white font-bold">{stat.value}</div>
                <div className="text-purple-300 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Weaknesses — only visible to profile owner */}
        {isMe && weaknesses.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <h2 className="text-white font-bold text-lg mb-4">📊 Your Performance</h2>
            <div className="space-y-3">
              {weaknesses.map(w => {
                const pct   = Math.round(w.accuracy_rate * 100)
                const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                return (
                  <div key={w.category}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white text-sm font-medium">
                        {categoryEmoji[w.category] ?? '📐'} {w.category.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-purple-300 text-xs">{w.total_attempts} attempts</span>
                        <span className={`text-xs font-bold ${
                          pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-purple-300 text-xs mt-4 text-center">
              Practice your weakest topics to level up faster!
            </p>
          </div>
        )}

        {isMe && weaknesses.length === 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-white font-bold mb-1">No battle data yet!</p>
            <p className="text-purple-300 text-sm">Play some battles to see your performance breakdown.</p>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex gap-3">
          <Link href="/lobby"
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 rounded-xl transition text-center">
            ⚔️ Play
          </Link>
          <Link href="/leaderboard"
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
            🏆 Leaderboard
          </Link>
        </div>

      </div>
    </div>
  )
}