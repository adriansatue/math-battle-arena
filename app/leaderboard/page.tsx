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

type Bracket = 'all' | 'beginner' | 'rising' | 'champion'
type TimePeriod = 'alltime' | 'weekly'

const BRACKETS: { key: Bracket; label: string; emoji: string; desc: string; min: number; max: number }[] = [
  { key: 'beginner',  label: 'Beginners',    emoji: '🌱', desc: 'Level 1–2',  min: 1, max: 2 },
  { key: 'rising',    label: 'Rising Stars', emoji: '⭐', desc: 'Level 3–5',  min: 3, max: 5 },
  { key: 'champion',  label: 'Champions',    emoji: '🔥', desc: 'Level 6–8',  min: 6, max: 8 },
  { key: 'all',       label: 'All Players',  emoji: '🌍', desc: 'Everyone',   min: 1, max: 99 },
]

function bracketForLevel(level: number): Bracket {
  if (level <= 2) return 'beginner'
  if (level <= 5) return 'rising'
  return 'champion'
}

export default function LeaderboardPage() {
  const [players,      setPlayers]      = useState<Player[]>([])
  const [loading,      setLoading]      = useState(true)
  const [currentId,    setCurrentId]    = useState('')
  const [bracket,      setBracket]      = useState<Bracket>('all')
  const [timePeriod,   setTimePeriod]   = useState<TimePeriod>('alltime')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentId(user.id)
        // Auto-select the current player's own bracket
        const { data: profile } = await supabase
          .from('profiles')
          .select('level')
          .eq('id', user.id)
          .single()
        if (profile) setBracket(bracketForLevel(profile.level as number))
      }

      if (timePeriod === 'alltime') {
        // Fetch all-time leaderboard
        const { data } = await supabase
          .from('profiles')
          .select('id, username, total_points, level, rank_title, wins, losses, best_streak')
          .neq('rank_title', 'AI Challenger')
          .not('username', 'ilike', '%MathBot%')
          .order('total_points', { ascending: false })
          .limit(50)

        setPlayers((data as Player[]) ?? [])
      } else {
        // Fetch weekly leaderboard (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const sevenDaysAgoISO = sevenDaysAgo.toISOString()

        console.log('[Leaderboard] Weekly fetch - Last 7 days since:', sevenDaysAgoISO)

        // Get all profiles first (including total_points for validation)
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, username, level, rank_title, wins, losses, best_streak, total_points')
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
          .select('id, finished_at, winner_id')
          .gte('finished_at', sevenDaysAgoISO)

        const battleIds = battles?.map(b => b.id) ?? []
        console.log('[Leaderboard] Battles in last 7 days:', battleIds.length)

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

        console.log('[Leaderboard] Total answers:', answers?.length)

        // Calculate total points per player for the week
        const weeklyPoints: Record<string, number> = {}
        answers?.forEach(answer => {
          weeklyPoints[answer.player_id] = (weeklyPoints[answer.player_id] ?? 0) + answer.points_earned
        })

        console.log('[Leaderboard] Points from answers:', weeklyPoints)

        // Add 200 point winner bonus for each battle won this week
        battles?.forEach(battle => {
          if (battle.winner_id) {
            weeklyPoints[battle.winner_id] = (weeklyPoints[battle.winner_id] ?? 0) + 200
          }
        })

        console.log('[Leaderboard] Points after winner bonuses:', weeklyPoints)

        // Find user dasafa if exists for debugging
        const dasafaProfile = allProfiles.find(p => p.username === 'dasafa')
        if (dasafaProfile) {
          console.log('[Leaderboard] DASAFA DEBUG:', {
            id: dasafaProfile.id,
            username: dasafaProfile.username,
            allTimePoints: dasafaProfile.total_points,
            weeklyCalculated: weeklyPoints[dasafaProfile.id] ?? 0,
          })
        }

        // Find Adrian for debugging
        const adrianProfile = allProfiles.find(p => p.username === 'Adrian')
        if (adrianProfile) {
          // Get all battles for Adrian this week
          const adrianBattles = battles?.filter(b => b.winner_id === adrianProfile.id)
          const adrianAnswers = answers?.filter(a => a.player_id === adrianProfile.id)
          console.log('[Leaderboard] ADRIAN DEBUG:', {
            id: adrianProfile.id,
            username: adrianProfile.username,
            allTimePoints: adrianProfile.total_points,
            weeklyCalculated: weeklyPoints[adrianProfile.id] ?? 0,
            battlesWonThisWeek: adrianBattles?.length ?? 0,
            answerCount: adrianAnswers?.length ?? 0,
            answerPoints: adrianAnswers?.reduce((sum, a) => sum + a.points_earned, 0) ?? 0,
            winnerBonuses: (adrianBattles?.length ?? 0) * 200,
            expectedTotal: (adrianAnswers?.reduce((sum, a) => sum + a.points_earned, 0) ?? 0) + ((adrianBattles?.length ?? 0) * 200),
            allBattles: battles?.slice(0, 10).map(b => ({ id: b.id, winner: b.winner_id, finished: b.finished_at })),
          })
        }

        // Build weekly leaderboard
        const weeklyPlayers = allProfiles
          .filter(p => weeklyPoints[p.id] && weeklyPoints[p.id] > 0)
          .map(p => ({
            id: p.id,
            username: p.username,
            total_points: weeklyPoints[p.id] ?? 0,
            level: p.level,
            rank_title: p.rank_title,
            wins: p.wins,
            losses: p.losses,
            best_streak: p.best_streak,
          }))
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
    level >= 8 ? 'text-yellow-400' :
    level >= 6 ? 'text-purple-400' :
    level >= 4 ? 'text-blue-400'   :
    level >= 2 ? 'text-green-400'  : 'text-gray-400'

  const activeBracket = BRACKETS.find(b => b.key === bracket)!
  const filtered = bracket === 'all'
    ? players
    : players.filter(p => p.level >= activeBracket.min && p.level <= activeBracket.max)

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
            {timePeriod === 'alltime' ? 'All-time champions' : 'This week\'s top players'}
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
        </div>

        {/* Bracket filter tabs */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {BRACKETS.map(b => (
            <button
              key={b.key}
              onClick={() => setBracket(b.key)}
              className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl border transition-all ${
                bracket === b.key
                  ? 'bg-purple-600/40 border-purple-400/60 text-white'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              <span className="text-xl">{b.emoji}</span>
              <span className="text-xs font-bold leading-tight text-center">{b.label}</span>
              <span className="text-[10px] opacity-60">{b.desc}</span>
            </button>
          ))}
        </div>

        {/* Empty bracket state */}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-purple-300">
            <div className="text-5xl mb-4">{activeBracket.emoji}</div>
            <p className="font-bold text-white text-lg mb-1">
              {timePeriod === 'weekly' ? 'No weekly battles yet!' : 'No players here yet!'}
            </p>
            <p className="text-sm">
              {timePeriod === 'weekly' 
                ? 'Play some battles this week to climb the weekly rankings!' 
                : `Be the first ${activeBracket.label} on the board.`}
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
              <p className="text-white font-bold mt-2">{filtered[1].total_points.toLocaleString()}</p>
              <p className="text-purple-300 text-xs">pts</p>
            </div>

            {/* 1st place */}
            <div className="bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 rounded-2xl p-4 text-center border border-yellow-500/40">
              <div className="text-4xl mb-2">👑</div>
              <p className="text-white font-bold truncate">{filtered[0].username}</p>
              <p className={`text-xs font-semibold ${levelColor(filtered[0].level)}`}>
                Lv.{filtered[0].level} · {filtered[0].rank_title}
              </p>
              <p className="text-yellow-400 font-bold text-xl mt-2">
                {filtered[0].total_points.toLocaleString()}
              </p>
              <p className="text-yellow-300 text-xs">pts</p>
            </div>

            {/* 3rd place */}
            <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/20 mt-6">
              <div className="text-3xl mb-2">🥉</div>
              <p className="text-white font-bold text-sm truncate">{filtered[2].username}</p>
              <p className={`text-xs font-semibold ${levelColor(filtered[2].level)}`}>
                Lv.{filtered[2].level}
              </p>
              <p className="text-white font-bold mt-2">{filtered[2].total_points.toLocaleString()}</p>
              <p className="text-purple-300 text-xs">pts</p>
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
                    <p className="text-white font-bold">{player.total_points.toLocaleString()}</p>
                    <p className="text-purple-300 text-xs">pts</p>
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