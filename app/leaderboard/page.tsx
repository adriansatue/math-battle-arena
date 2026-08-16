'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { WIN_XP_BONUS, getLevelAndRank, getRewardMode } from '@/lib/game/scoring'

interface Player {
  id:            string
  username:      string
  total_points:  number
  rating:        number
  level:         number
  rank_title:    string
  wins:          number
  losses:        number
  best_streak:   number
}

type Bracket = 'all' | 'starter' | 'builder' | 'challenger' | 'solver' | 'strategist' | 'specialist' | 'expert' | 'contender' | 'elite' | 'master'
type TimePeriod = 'alltime' | 'weekly' | 'rating'

const BRACKETS: { key: Bracket; label: string; emoji: string; desc: string; min: number; max: number }[] = [
  { key: 'starter',    label: 'Starter',     emoji: 'I',    desc: 'Lv. 1-10',   min: 1,  max: 10 },
  { key: 'builder',    label: 'Builder',     emoji: 'II',   desc: 'Lv. 11-20',  min: 11, max: 20 },
  { key: 'challenger', label: 'Challenger',  emoji: 'III',  desc: 'Lv. 21-30',  min: 21, max: 30 },
  { key: 'solver',     label: 'Solver',      emoji: 'IV',   desc: 'Lv. 31-40',  min: 31, max: 40 },
  { key: 'strategist', label: 'Strategist',  emoji: 'V',    desc: 'Lv. 41-50',  min: 41, max: 50 },
  { key: 'specialist', label: 'Specialist',  emoji: 'VI',   desc: 'Lv. 51-60',  min: 51, max: 60 },
  { key: 'expert',     label: 'Expert',      emoji: 'VII',  desc: 'Lv. 61-70',  min: 61, max: 70 },
  { key: 'contender',  label: 'Contender',   emoji: 'VIII', desc: 'Lv. 71-80',  min: 71, max: 80 },
  { key: 'elite',      label: 'Elite',       emoji: 'IX',   desc: 'Lv. 81-90',  min: 81, max: 90 },
  { key: 'master',     label: 'Master',      emoji: 'X',    desc: 'Lv. 91-100', min: 91, max: 100 },
  { key: 'all',        label: 'All Players', emoji: 'All',  desc: 'Everyone',   min: 1,  max: 100 },
]

function withComputedProgress(player: Player): Player {
  const progress = getLevelAndRank(player.total_points ?? 0)
  return {
    ...player,
    level:      progress.level,
    rank_title: progress.rank_title,
  }
}

export default function LeaderboardPage() {
  const [players,      setPlayers]      = useState<Player[]>([])
  const [loading,      setLoading]      = useState(true)
  const [currentId,    setCurrentId]    = useState('')
  const [currentLevel, setCurrentLevel] = useState<number | null>(null)
  const [bracket,      setBracket]      = useState<Bracket>('all')
  const [timePeriod,   setTimePeriod]   = useState<TimePeriod>('alltime')
  const [searchTerm,   setSearchTerm]   = useState('')
  const [nearMyLevel,  setNearMyLevel]  = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentId(user.id)
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('total_points')
          .eq('id', user.id)
          .single()

        if (currentProfile) {
          setCurrentLevel(getLevelAndRank(currentProfile.total_points ?? 0).level)
        }
      }

      if (timePeriod === 'alltime') {
        // Fetch all-time leaderboard
        const { data } = await supabase
          .from('profiles')
          .select('id, username, total_points, rating, level, rank_title, wins, losses, best_streak')
          .neq('rank_title', 'AI Challenger')
          .not('username', 'ilike', '%MathBot%')
          .order('total_points', { ascending: false })
          .limit(50)

        setPlayers(((data as Player[] | null) ?? []).map(withComputedProgress))
      } else if (timePeriod === 'rating') {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, total_points, rating, level, rank_title, wins, losses, best_streak')
          .neq('rank_title', 'AI Challenger')
          .not('username', 'ilike', '%MathBot%')
          .order('rating', { ascending: false })
          .limit(50)

        setPlayers(((data as Player[] | null) ?? []).map(withComputedProgress))
      } else {
        // Fetch weekly leaderboard (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const sevenDaysAgoISO = sevenDaysAgo.toISOString()

        // Get all profiles first (including total_points for validation)
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, username, level, rank_title, wins, losses, best_streak, total_points, rating')
          .neq('rank_title', 'AI Challenger')
          .not('username', 'ilike', '%MathBot%')

        if (!allProfiles) {
          setPlayers([])
          setLoading(false)
          return
        }

        // Calculate weekly points for each player
        const { data: battles } = await supabase
          .from('battles')
          .select('id, finished_at, winner_id, guest_id, bot_id')
          .eq('status', 'finished')
          .gte('finished_at', sevenDaysAgoISO)

        const battleIds = battles?.map(b => b.id) ?? []

        if (battleIds.length === 0) {
          // No battles in the last 7 days
          setPlayers([])
          setLoading(false)
          return
        }

        const { data: answers } = await supabase
          .from('battle_answers')
          .select('player_id, points_earned')
          .in('battle_id', battleIds)

        // Calculate total points per player for the week
        const weeklyPoints: Record<string, number> = {}
        answers?.forEach(answer => {
          weeklyPoints[answer.player_id] = (weeklyPoints[answer.player_id] ?? 0) + answer.points_earned
        })

        // Add the same mode-aware winner XP bonus used at battle finish.
        battles?.forEach(battle => {
          if (battle.winner_id) {
            const mode = getRewardMode(battle)
            weeklyPoints[battle.winner_id] = (weeklyPoints[battle.winner_id] ?? 0) + WIN_XP_BONUS[mode]
          }
        })

        // Build weekly leaderboard
        const weeklyPlayers = allProfiles
          .filter(p => weeklyPoints[p.id] && weeklyPoints[p.id] > 0)
          .map(p => {
            const progress = getLevelAndRank(p.total_points ?? 0)
            return {
              id: p.id,
              username: p.username,
              total_points: weeklyPoints[p.id] ?? 0,
              rating: p.rating ?? 1000,
              level: progress.level,
              rank_title: progress.rank_title,
              wins: p.wins,
              losses: p.losses,
              best_streak: p.best_streak,
            }
          })
          .sort((a, b) => b.total_points - a.total_points)
          .slice(0, 50)

        setPlayers(weeklyPlayers as Player[])
      }

      setLoading(false)
    }
    load()
  }, [timePeriod])

  const rankEmoji = (i: number) =>
    i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

  const levelColor = (level: number) =>
    level >= 91 ? 'text-yellow-400' :
    level >= 71 ? 'text-purple-400' :
    level >= 51 ? 'text-blue-400'   :
    level >= 31 ? 'text-green-400'  : 'text-gray-400'

  const activeBracket = BRACKETS.find(b => b.key === bracket)!
  const tierFiltered = bracket === 'all'
    ? players
    : players.filter(p => p.level >= activeBracket.min && p.level <= activeBracket.max)
  const nearbyFiltered = nearMyLevel && currentLevel
    ? tierFiltered.filter(p => Math.abs(p.level - currentLevel) <= 10)
    : tierFiltered
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filtered = normalizedSearch
    ? nearbyFiltered.filter(p => p.username.toLowerCase().includes(normalizedSearch))
    : nearbyFiltered
  const emptyFilterLabel = nearMyLevel && currentLevel
    ? `players near level ${currentLevel}`
    : activeBracket.label
  const scoreLabel = timePeriod === 'rating' ? 'rating' : 'XP'
  const scoreValue = (player: Player) =>
    timePeriod === 'rating' ? player.rating ?? 1000 : player.total_points

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse text-xl">Loading leaderboard...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-4xl font-bold text-white mb-2">🏆 Leaderboard</h1>
          <p className="text-purple-300">
            {timePeriod === 'alltime'
              ? 'All-time XP champions'
              : timePeriod === 'rating'
              ? 'Top PvP rating'
              : 'This week\'s top XP players'}
          </p>
        </div>

        {/* Time Period Toggle */}
        <div className="flex gap-2 mb-6 justify-center">
          <button
            onClick={() => setTimePeriod('alltime')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              timePeriod === 'alltime'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            }`}
          >
            👑 All Time
          </button>
          <button
            onClick={() => setTimePeriod('weekly')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              timePeriod === 'weekly'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            }`}
          >
            🔥 This Week
          </button>
          <button
            onClick={() => setTimePeriod('rating')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              timePeriod === 'rating'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            }`}
          >
            PvP Rating
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/35">
                Search player
              </span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Username"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-purple-400/60"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/35">
                Level tier
              </span>
              <span className="relative block rounded-xl focus-within:ring-2 focus-within:ring-purple-400/25">
                <select
                  value={bracket}
                  onChange={(event) => setBracket(event.target.value as Bracket)}
                  className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-black/20 py-3 pl-4 pr-11 text-sm font-bold text-white outline-none transition hover:border-purple-300/30 hover:bg-white/[0.06] focus:border-purple-400/60"
                >
                  {BRACKETS.map(b => (
                    <option key={b.key} value={b.key} className="bg-slate-950 text-white">
                      {b.label}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 h-2.5 w-2.5 -translate-y-2/3 rotate-45 border-b-2 border-r-2 border-purple-200/80"
                />
              </span>
            </label>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => setNearMyLevel(value => !value)}
              disabled={!currentLevel}
              className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${
                nearMyLevel && currentLevel
                  ? 'border-purple-400/60 bg-purple-600/40 text-white'
                  : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
              }`}
            >
              Near my level {currentLevel ? `(Lv. ${Math.max(1, currentLevel - 10)}-${Math.min(100, currentLevel + 10)})` : ''}
            </button>

            <p className="text-xs text-white/35">
              Showing {filtered.length} of {players.length} players
            </p>
          </div>
        </div>

        {/* Empty bracket state */}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-purple-300">
            <div className="text-5xl mb-4">{nearMyLevel ? '±10' : activeBracket.emoji}</div>
            <p className="font-bold text-white text-lg mb-1">
              {timePeriod === 'weekly' ? 'No weekly battles yet!' : 'No players here yet!'}
            </p>
            <p className="text-sm">
              {timePeriod === 'weekly' 
                ? 'Play some battles this week to climb the weekly rankings!' 
                : normalizedSearch
                ? `No players match "${searchTerm.trim()}".`
                : `Be the first ${emptyFilterLabel} on the board.`}
            </p>
          </div>
        )}

        {/* Top 3 podium */}
        {filtered.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {/* 2nd place */}
            <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/20 mt-6">
              <div className="text-3xl mb-2">🥈</div>
              <p className="text-white font-bold text-sm truncate">{filtered[1].username}</p>
              <p className={`text-xs font-semibold ${levelColor(filtered[1].level)}`}>
                Lv.{filtered[1].level}
              </p>
              <p className="text-white font-bold mt-2">{scoreValue(filtered[1]).toLocaleString()}</p>
              <p className="text-purple-300 text-xs">{scoreLabel}</p>
            </div>

            {/* 1st place */}
            <div className="bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 rounded-2xl p-4 text-center border border-yellow-500/40">
              <div className="text-4xl mb-2">👑</div>
              <p className="text-white font-bold truncate">{filtered[0].username}</p>
              <p className={`text-xs font-semibold ${levelColor(filtered[0].level)}`}>
                Lv.{filtered[0].level} · {filtered[0].rank_title}
              </p>
              <p className="text-yellow-400 font-bold text-xl mt-2">
                {scoreValue(filtered[0]).toLocaleString()}
              </p>
              <p className="text-yellow-300 text-xs">{scoreLabel}</p>
            </div>

            {/* 3rd place */}
            <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/20 mt-6">
              <div className="mb-2 flex justify-center">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Bronze medal circle */}
                  <circle cx="24" cy="28" r="18" fill="#CD7F32" />
                  <circle cx="24" cy="28" r="15" fill="#E8A060" />
                  {/* Ribbon top */}
                  <polygon points="18,4 24,12 30,4" fill="#C0392B" />
                  <rect x="19" y="4" width="10" height="8" rx="1" fill="#E74C3C" />
                  {/* Number 3 */}
                  <text x="24" y="34" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#7B4A10" fontFamily="Arial, sans-serif">3</text>
                </svg>
              </div>
              <p className="text-white font-bold text-sm truncate">{filtered[2].username}</p>
              <p className={`text-xs font-semibold ${levelColor(filtered[2].level)}`}>
                Lv.{filtered[2].level}
              </p>
              <p className="text-white font-bold mt-2">{scoreValue(filtered[2]).toLocaleString()}</p>
              <p className="text-purple-300 text-xs">{scoreLabel}</p>
            </div>
          </div>
        )}

        {/* Full list */}
        {filtered.length > 0 && (
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
          {filtered.map((player, i) => {
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
                    <p className="text-white font-bold">{scoreValue(player).toLocaleString()}</p>
                    <p className="text-purple-300 text-xs">{scoreLabel}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
        )}

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
