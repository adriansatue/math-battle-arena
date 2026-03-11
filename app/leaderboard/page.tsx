'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Player {
  id:            string
  username:      string
  total_points:  number
  level:         number
  rank_title:    string
  wins:          number
  losses:        number
  best_streak:   number
}

export default function LeaderboardPage() {
  const [players,   setPlayers]   = useState<Player[]>([])
  const [loading,   setLoading]   = useState(true)
  const [currentId, setCurrentId] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentId(user.id)

      const { data } = await supabase
        .from('profiles')
        .select('id, username, total_points, level, rank_title, wins, losses, best_streak')
        .neq('rank_title', 'AI Challenger')
        .not('username', 'ilike', '%MathBot%')
        .order('total_points', { ascending: false })
        .limit(50)

      setPlayers((data as Player[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const rankEmoji = (i: number) =>
    i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

  const levelColor = (level: number) =>
    level >= 8 ? 'text-yellow-400' :
    level >= 6 ? 'text-purple-400' :
    level >= 4 ? 'text-blue-400'   :
    level >= 2 ? 'text-green-400'  : 'text-gray-400'

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse text-xl">Loading leaderboard...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <h1 className="text-4xl font-bold text-white mb-2">🏆 Leaderboard</h1>
          <p className="text-purple-300">Top 50 Math Battle champions</p>
        </div>

        {/* Top 3 podium */}
        {players.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {/* 2nd place */}
            <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/20 mt-6">
              <div className="text-3xl mb-2">🥈</div>
              <p className="text-white font-bold text-sm truncate">{players[1].username}</p>
              <p className={`text-xs font-semibold ${levelColor(players[1].level)}`}>
                Lv.{players[1].level}
              </p>
              <p className="text-white font-bold mt-2">{players[1].total_points.toLocaleString()}</p>
              <p className="text-purple-300 text-xs">pts</p>
            </div>

            {/* 1st place */}
            <div className="bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 rounded-2xl p-4 text-center border border-yellow-500/40">
              <div className="text-4xl mb-2">👑</div>
              <p className="text-white font-bold truncate">{players[0].username}</p>
              <p className={`text-xs font-semibold ${levelColor(players[0].level)}`}>
                Lv.{players[0].level} · {players[0].rank_title}
              </p>
              <p className="text-yellow-400 font-bold text-xl mt-2">
                {players[0].total_points.toLocaleString()}
              </p>
              <p className="text-yellow-300 text-xs">pts</p>
            </div>

            {/* 3rd place */}
            <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/20 mt-6">
              <div className="text-3xl mb-2">🥉</div>
              <p className="text-white font-bold text-sm truncate">{players[2].username}</p>
              <p className={`text-xs font-semibold ${levelColor(players[2].level)}`}>
                Lv.{players[2].level}
              </p>
              <p className="text-white font-bold mt-2">{players[2].total_points.toLocaleString()}</p>
              <p className="text-purple-300 text-xs">pts</p>
            </div>
          </div>
        )}

        {/* Full list */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
          {players.map((player, i) => {
            const isMe      = player.id === currentId
            const winRate   = player.wins + player.losses > 0
              ? Math.round((player.wins / (player.wins + player.losses)) * 100)
              : 0

            return (
              <Link key={player.id} href={`/profile/${player.id}`}>
                <div className={`flex items-center gap-4 px-4 py-3 border-b border-white/10 hover:bg-white/5 transition cursor-pointer ${
                  isMe ? 'bg-purple-600/20' : ''
                }`}>

                  {/* Rank */}
                  <div className="w-10 text-center text-lg font-bold">
                    {typeof rankEmoji(i) === 'string' && rankEmoji(i).startsWith('#')
                      ? <span className="text-white/40 text-sm">{rankEmoji(i)}</span>
                      : <span>{rankEmoji(i)}</span>
                    }
                  </div>

                  {/* Avatar placeholder */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    isMe ? 'bg-purple-600' : 'bg-white/20'
                  }`}>
                    {player.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + rank */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold truncate ${isMe ? 'text-purple-300' : 'text-white'}`}>
                        {player.username} {isMe && '(you)'}
                      </p>
                    </div>
                    <p className={`text-xs ${levelColor(player.level)}`}>
                      Lv.{player.level} · {player.rank_title}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right hidden sm:block">
                    <p className="text-white/50 text-xs">
                      {player.wins}W · {player.losses}L · {winRate}%
                    </p>
                    <p className="text-white/30 text-xs">
                      🔥 {player.best_streak} streak
                    </p>
                  </div>

                  {/* Points */}
                  <div className="text-right">
                    <p className="text-white font-bold">{player.total_points.toLocaleString()}</p>
                    <p className="text-purple-300 text-xs">pts</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Nav */}
        <div className="flex gap-3 mt-6">
          <Link href="/lobby"
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-center">
            ⚔️ Play
          </Link>
          <Link href={`/profile/${currentId}`}
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 rounded-xl transition text-center">
            👤 My Profile
          </Link>
        </div>

      </div>
    </div>
  )
}