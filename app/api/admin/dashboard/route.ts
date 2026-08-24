import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/admin-guard'

type ProfileRow = {
  id: string
  username: string | null
  total_points: number | null
  points_balance: number | null
  rating: number | null
  wins: number | null
  losses: number | null
  current_streak: number | null
  best_streak: number | null
  level: number | null
  rank_title: string | null
  is_admin: boolean | null
}

type BattleRow = {
  id: string
  host_id: string | null
  guest_id: string | null
  status: string | null
  mode: string | null
  difficulty: string | null
  question_count: number | null
  winner_id: string | null
  host_score: number | null
  guest_score: number | null
  bot_id: string | null
  bet_status: string | null
  created_at: string | null
  started_at: string | null
  finished_at: string | null
}

type AnswerRow = {
  battle_id: string | null
  player_id: string | null
  points_earned: number | null
  is_correct: boolean | null
  time_taken_ms: number | null
  server_validated_ms: number | null
  flagged: boolean | null
  answered_at: string | null
}

type InventoryRow = {
  user_id: string | null
}

type PlayerStats = {
  id: string
  username: string
  level: number
  rankTitle: string
  totalPoints: number
  pointsBalance: number
  rating: number
  profileWins: number
  profileLosses: number
  currentStreak: number
  bestStreak: number
  battlesPlayed: number
  finishedBattles: number
  pvpBattles: number
  botBattles: number
  practiceBattles: number
  derivedWins: number
  derivedLosses: number
  answers: number
  correctAnswers: number
  accuracy: number
  avgResponseMs: number | null
  fastestResponseMs: number | null
  totalAnswerPoints: number
  flaggedAnswers: number
  cardsOwned: number
  lastPlayedAt: string | null
}

const DATA_LIMIT = 10000
const STALE_ACTIVE_MS = 30 * 60 * 1000
const STALE_WAITING_MS = 15 * 60 * 1000
const PLAYER_PAGE_SIZE = 20

const PLAYER_SORTS = {
  lastPlayedAt: (a: PlayerStats, b: PlayerStats) => timestamp(b.lastPlayedAt) - timestamp(a.lastPlayedAt),
  flaggedAnswers: (a: PlayerStats, b: PlayerStats) => b.flaggedAnswers - a.flaggedAnswers,
  battlesPlayed: (a: PlayerStats, b: PlayerStats) => b.battlesPlayed - a.battlesPlayed,
  rating: (a: PlayerStats, b: PlayerStats) => b.rating - a.rating,
  accuracy: (a: PlayerStats, b: PlayerStats) => b.accuracy - a.accuracy,
} satisfies Record<string, (a: PlayerStats, b: PlayerStats) => number>

function numberValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function timestamp(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0
}

function laterDate(current: string | null, candidate: string | null | undefined) {
  if (!candidate) return current
  return timestamp(candidate) > timestamp(current) ? candidate : current
}

function isBotProfile(profile: ProfileRow) {
  const username = profile.username?.toLowerCase() ?? ''
  return profile.rank_title === 'AI Challenger' || username.includes('mathbot')
}

function battleKind(battle: BattleRow) {
  if (!battle.guest_id) return 'practice'
  if (battle.bot_id) return 'bot'
  return 'pvp'
}

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, 40)
  const attentionOnly = url.searchParams.get('attention') === 'true'
  const requestedSort = url.searchParams.get('sort') ?? 'lastPlayedAt'
  const sort = requestedSort in PLAYER_SORTS ? requestedSort as keyof typeof PLAYER_SORTS : 'lastPlayedAt'
  const direction = url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc'
  const requestedPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1

  const admin = createAdminClient()
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const [metricsRes, playerPageRes] = await Promise.all([
    admin.rpc('get_admin_dashboard_metrics', { p_now: new Date(now).toISOString() }),
    admin.rpc('get_admin_dashboard_players', {
      p_search: search,
      p_attention_only: attentionOnly,
      p_sort: sort,
      p_direction: direction,
      p_page: page,
      p_page_size: PLAYER_PAGE_SIZE,
    }),
  ])

  if (!metricsRes.error && !playerPageRes.error && metricsRes.data && playerPageRes.data) {
    const metrics = metricsRes.data as {
      summary?: Record<string, unknown>
      trends?: unknown
      funnel?: unknown[]
      alerts?: {
        staleActiveBattles?: number
        staleWaitingBattles?: number
        flaggedPlayers?: { id: string; username: string; flaggedAnswers: number }[]
      }
    }
    const playerPage = playerPageRes.data as { total?: number; players?: PlayerStats[] }
    const recentBattlesRes = await admin
      .from('battles')
      .select('id, host_id, guest_id, status, mode, difficulty, question_count, winner_id, host_score, guest_score, bot_id, bet_status, created_at, started_at, finished_at')
      .order('created_at', { ascending: false })
      .limit(12)

    if (recentBattlesRes.error) {
      return NextResponse.json({ error: recentBattlesRes.error.message }, { status: 500 })
    }

    const recentBattleRows = (recentBattlesRes.data ?? []) as BattleRow[]
    const profileIds = [...new Set(recentBattleRows.flatMap(battle => [battle.host_id, battle.guest_id, battle.winner_id]).filter((id): id is string => Boolean(id)))]
    const recentProfilesRes = profileIds.length > 0
      ? await admin.from('profiles').select('id, username').in('id', profileIds)
      : { data: [], error: null }
    if (recentProfilesRes.error) {
      return NextResponse.json({ error: recentProfilesRes.error.message }, { status: 500 })
    }
    const recentProfileMap = new Map(((recentProfilesRes.data ?? []) as Pick<ProfileRow, 'id' | 'username'>[]).map(profile => [profile.id, profile]))
    const recentBattles = recentBattleRows.map(battle => {
      const kind = battleKind(battle)
      return {
        id: battle.id,
        status: battle.status ?? 'unknown',
        kind,
        mode: battle.mode ?? 'unknown',
        difficulty: battle.difficulty ?? 'unknown',
        questionCount: numberValue(battle.question_count),
        hostName: battle.host_id ? recentProfileMap.get(battle.host_id)?.username ?? 'Unknown host' : 'Unknown host',
        guestName: battle.guest_id ? recentProfileMap.get(battle.guest_id)?.username ?? 'Waiting' : kind === 'practice' ? 'Practice' : 'Waiting',
        winnerName: battle.winner_id ? recentProfileMap.get(battle.winner_id)?.username ?? null : null,
        hostScore: numberValue(battle.host_score),
        guestScore: numberValue(battle.guest_score),
        betStatus: battle.bet_status ?? null,
        createdAt: battle.created_at,
        startedAt: battle.started_at,
        finishedAt: battle.finished_at,
      }
    })
    const totalPlayers = typeof playerPage.total === 'number' ? playerPage.total : 0
    const totalPages = Math.max(1, Math.ceil(totalPlayers / PLAYER_PAGE_SIZE))

    return NextResponse.json({
      refreshedAt: new Date().toISOString(),
      summary: { ...(metrics.summary ?? {}), dataLimit: null },
      trends: metrics.trends ?? null,
      funnel: metrics.funnel ?? [],
      alerts: {
        staleActiveBattles: metrics.alerts?.staleActiveBattles ?? 0,
        staleWaitingBattles: metrics.alerts?.staleWaitingBattles ?? 0,
        flaggedPlayers: metrics.alerts?.flaggedPlayers ?? [],
      },
      playerPagination: {
        page: Math.min(page, totalPages),
        pageSize: PLAYER_PAGE_SIZE,
        total: totalPlayers,
        totalPages,
        search,
        attentionOnly,
        sort,
        direction,
      },
      players: playerPage.players ?? [],
      recentBattles,
    })
  }

  const [
    profilesRes,
    battlesRes,
    answersRes,
    inventoryRes,
    cardsRes,
    usersCount,
    battlesCount,
    activeBattlesCount,
    finishedBattlesCount,
    waitingBattlesCount,
    answersCount,
    flaggedCount,
    queueCount,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, username, total_points, points_balance, rating, wins, losses, current_streak, best_streak, level, rank_title, is_admin')
      .range(0, DATA_LIMIT - 1),
    admin
      .from('battles')
      .select('id, host_id, guest_id, status, mode, difficulty, question_count, winner_id, host_score, guest_score, bot_id, bet_status, created_at, started_at, finished_at')
      .order('created_at', { ascending: false })
      .range(0, DATA_LIMIT - 1),
    admin
      .from('battle_answers')
      .select('battle_id, player_id, points_earned, is_correct, time_taken_ms, server_validated_ms, flagged, answered_at')
      .order('answered_at', { ascending: false })
      .range(0, DATA_LIMIT - 1),
    admin
      .from('user_inventory')
      .select('user_id')
      .range(0, DATA_LIMIT - 1),
    admin
      .from('reward_catalog')
      .select('id, is_active')
      .range(0, DATA_LIMIT - 1),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('battles').select('id', { count: 'exact', head: true }),
    admin.from('battles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('battles').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
    admin.from('battles').select('id', { count: 'exact', head: true }).eq('status', 'waiting'),
    admin.from('battle_answers').select('id', { count: 'exact', head: true }),
    admin.from('battle_answers').select('id', { count: 'exact', head: true }).eq('flagged', true),
    admin.from('matchmaking_queue').select('id', { count: 'exact', head: true }),
  ])

  const fetchError =
    profilesRes.error ??
    battlesRes.error ??
    answersRes.error ??
    inventoryRes.error ??
    cardsRes.error ??
    usersCount.error ??
    battlesCount.error ??
    activeBattlesCount.error ??
    finishedBattlesCount.error ??
    waitingBattlesCount.error ??
    answersCount.error ??
    flaggedCount.error ??
    queueCount.error

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const profiles = (profilesRes.data ?? []) as ProfileRow[]
  const battles = (battlesRes.data ?? []) as BattleRow[]
  const answers = (answersRes.data ?? []) as AnswerRow[]
  const inventory = (inventoryRes.data ?? []) as InventoryRow[]
  const cards = cardsRes.data ?? []

  const profileMap = new Map(profiles.map(profile => [profile.id, profile]))
  const botProfileIds = new Set(profiles.filter(isBotProfile).map(profile => profile.id))
  const battleById = new Map(battles.map(battle => [battle.id, battle]))
  const playerStats = new Map<string, PlayerStats>()
  const responseTimes: number[] = []

  profiles
    .filter(profile => !isBotProfile(profile))
    .forEach(profile => {
      playerStats.set(profile.id, {
        id: profile.id,
        username: profile.username ?? 'Unnamed player',
        level: numberValue(profile.level),
        rankTitle: profile.rank_title ?? 'Unranked',
        totalPoints: numberValue(profile.total_points),
        pointsBalance: numberValue(profile.points_balance),
        rating: numberValue(profile.rating) || 1000,
        profileWins: numberValue(profile.wins),
        profileLosses: numberValue(profile.losses),
        currentStreak: numberValue(profile.current_streak),
        bestStreak: numberValue(profile.best_streak),
        battlesPlayed: 0,
        finishedBattles: 0,
        pvpBattles: 0,
        botBattles: 0,
        practiceBattles: 0,
        derivedWins: 0,
        derivedLosses: 0,
        answers: 0,
        correctAnswers: 0,
        accuracy: 0,
        avgResponseMs: null,
        fastestResponseMs: null,
        totalAnswerPoints: 0,
        flaggedAnswers: 0,
        cardsOwned: 0,
        lastPlayedAt: null,
      })
    })

  battles.forEach(battle => {
    const participants = [battle.host_id, battle.guest_id]
      .filter((id): id is string => Boolean(id))
      .filter(id => !botProfileIds.has(id))
    const kind = battleKind(battle)
    const activityAt = battle.finished_at ?? battle.started_at ?? battle.created_at

    participants.forEach(playerId => {
      const stats = playerStats.get(playerId)
      if (!stats) return

      stats.battlesPlayed += 1
      stats.lastPlayedAt = laterDate(stats.lastPlayedAt, activityAt)

      if (battle.status === 'finished') {
        stats.finishedBattles += 1

        if (battle.winner_id === playerId) stats.derivedWins += 1
        if (battle.winner_id && battle.winner_id !== playerId) stats.derivedLosses += 1
      }

      if (kind === 'practice') stats.practiceBattles += 1
      if (kind === 'bot') stats.botBattles += 1
      if (kind === 'pvp') stats.pvpBattles += 1
    })
  })

  answers.forEach(answer => {
    if (!answer.player_id || botProfileIds.has(answer.player_id)) return

    const stats = playerStats.get(answer.player_id)
    if (!stats) return

    const responseMs = numberValue(answer.time_taken_ms)

    stats.answers += 1
    stats.correctAnswers += answer.is_correct ? 1 : 0
    stats.totalAnswerPoints += numberValue(answer.points_earned)
    stats.flaggedAnswers += answer.flagged ? 1 : 0
    stats.lastPlayedAt = laterDate(stats.lastPlayedAt, answer.answered_at)

    if (responseMs > 0) {
      responseTimes.push(responseMs)
      stats.avgResponseMs = stats.avgResponseMs === null
        ? responseMs
        : Math.round(((stats.avgResponseMs * (stats.answers - 1)) + responseMs) / stats.answers)
      stats.fastestResponseMs = stats.fastestResponseMs === null
        ? responseMs
        : Math.min(stats.fastestResponseMs, responseMs)
    }

    const battle = answer.battle_id ? battleById.get(answer.battle_id) : null
    stats.lastPlayedAt = laterDate(stats.lastPlayedAt, battle?.finished_at ?? battle?.started_at ?? battle?.created_at)
  })

  inventory.forEach(item => {
    if (!item.user_id) return
    const stats = playerStats.get(item.user_id)
    if (stats) stats.cardsOwned += 1
  })

  const players = [...playerStats.values()]
    .map(stats => ({
      ...stats,
      accuracy: stats.answers > 0 ? Math.round((stats.correctAnswers / stats.answers) * 100) : 0,
    }))

  const activePlayers = players.filter(player => player.battlesPlayed > 0 || player.answers > 0)
  const recentPlayers = activePlayers.filter(player => timestamp(player.lastPlayedAt) >= weekAgo)
  const filteredPlayers = players.filter(player => {
    const matchesSearch = search.length === 0 || player.username.toLowerCase().includes(search.toLowerCase())
    const matchesAttention = !attentionOnly || player.flaggedAnswers > 0
    return matchesSearch && matchesAttention
  })
  const sortPlayer = PLAYER_SORTS[sort]
  filteredPlayers.sort((a, b) => {
    const result = sortPlayer(a, b)
    const directed = direction === 'asc' ? -result : result
    return directed !== 0 ? directed : a.username.localeCompare(b.username)
  })
  const totalPlayerPages = Math.max(1, Math.ceil(filteredPlayers.length / PLAYER_PAGE_SIZE))
  const currentPage = Math.min(page, totalPlayerPages)
  const playerOffset = (currentPage - 1) * PLAYER_PAGE_SIZE
  const battlesLast7Days = battles.filter(battle => timestamp(battle.created_at) >= weekAgo).length
  const answersLast7Days = answers.filter(answer => timestamp(answer.answered_at) >= weekAgo).length
  const correctAnswers = answers.filter(answer => answer.is_correct).length
  const averageResponseMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
    : null

  const pvpBattles = battles.filter(battle => battleKind(battle) === 'pvp').length
  const botBattles = battles.filter(battle => battleKind(battle) === 'bot').length
  const practiceBattles = battles.filter(battle => battleKind(battle) === 'practice').length
  const staleActiveBattles = battles.filter(battle =>
    battle.status === 'active' &&
    timestamp(battle.started_at ?? battle.created_at) > 0 &&
    now - timestamp(battle.started_at ?? battle.created_at) > STALE_ACTIVE_MS
  )
  const staleWaitingBattles = battles.filter(battle =>
    battle.status === 'waiting' &&
    timestamp(battle.created_at) > 0 &&
    now - timestamp(battle.created_at) > STALE_WAITING_MS
  )

  const recentBattles = battles.slice(0, 12).map(battle => {
    const host = battle.host_id ? profileMap.get(battle.host_id) : null
    const guest = battle.guest_id ? profileMap.get(battle.guest_id) : null
    const winner = battle.winner_id ? profileMap.get(battle.winner_id) : null

    return {
      id: battle.id,
      status: battle.status ?? 'unknown',
      kind: battleKind(battle),
      mode: battle.mode ?? 'unknown',
      difficulty: battle.difficulty ?? 'unknown',
      questionCount: numberValue(battle.question_count),
      hostName: host?.username ?? 'Unknown host',
      guestName: guest?.username ?? (battleKind(battle) === 'practice' ? 'Practice' : 'Waiting'),
      winnerName: winner?.username ?? null,
      hostScore: numberValue(battle.host_score),
      guestScore: numberValue(battle.guest_score),
      betStatus: battle.bet_status ?? null,
      createdAt: battle.created_at,
      startedAt: battle.started_at,
      finishedAt: battle.finished_at,
    }
  })

  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    summary: {
      totalUsers: usersCount.count ?? 0,
      realPlayers: players.length,
      activePlayers: activePlayers.length,
      activePlayersLast7Days: recentPlayers.length,
      totalBattles: battlesCount.count ?? 0,
      activeBattles: activeBattlesCount.count ?? 0,
      finishedBattles: finishedBattlesCount.count ?? 0,
      waitingBattles: waitingBattlesCount.count ?? 0,
      pvpBattles,
      botBattles,
      practiceBattles,
      battlesLast7Days,
      answers: answersCount.count ?? 0,
      answersLast7Days,
      accuracy: answers.length > 0 ? Math.round((correctAnswers / answers.length) * 100) : 0,
      averageResponseMs,
      flaggedAnswers: flaggedCount.count ?? 0,
      totalCards: cards.length,
      activeCards: cards.filter(card => card.is_active).length,
      inventoryCards: inventory.length,
      queueSize: queueCount.count ?? 0,
      dataLimit: DATA_LIMIT,
    },
    trends: null,
    funnel: [],
    alerts: {
      staleActiveBattles: staleActiveBattles.length,
      staleWaitingBattles: staleWaitingBattles.length,
      flaggedPlayers: players
        .filter(player => player.flaggedAnswers > 0)
        .sort((a, b) => b.flaggedAnswers - a.flaggedAnswers)
        .slice(0, 5)
        .map(player => ({
          id: player.id,
          username: player.username,
          flaggedAnswers: player.flaggedAnswers,
        })),
    },
    playerPagination: {
      page: currentPage,
      pageSize: PLAYER_PAGE_SIZE,
      total: filteredPlayers.length,
      totalPages: totalPlayerPages,
      search,
      attentionOnly,
      sort,
      direction,
    },
    players: filteredPlayers.slice(playerOffset, playerOffset + PLAYER_PAGE_SIZE),
    recentBattles,
  })
}
