'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type DashboardSummary = {
  totalUsers: number
  realPlayers: number
  activePlayers: number
  activePlayersLast7Days: number
  totalBattles: number
  activeBattles: number
  finishedBattles: number
  waitingBattles: number
  pvpBattles: number
  botBattles: number
  practiceBattles: number
  battlesLast7Days: number
  answers: number
  answersLast7Days: number
  accuracy: number
  averageResponseMs: number | null
  flaggedAnswers: number
  totalCards: number
  activeCards: number
  inventoryCards: number
  queueSize: number
  dataLimit: number
}

type DashboardPlayer = {
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

type RecentBattle = {
  id: string
  status: string
  kind: string
  mode: string
  difficulty: string
  questionCount: number
  hostName: string
  guestName: string
  winnerName: string | null
  hostScore: number
  guestScore: number
  betStatus: string | null
  createdAt: string | null
  startedAt: string | null
  finishedAt: string | null
}

type DashboardData = {
  refreshedAt: string
  summary: DashboardSummary
  trends: {
    current: { battles: number; finishedBattles: number; answers: number }
    previous: { battles: number; finishedBattles: number; answers: number }
  } | null
  funnel: { eventName: string; players: number }[]
  alerts: {
    staleActiveBattles: number
    staleWaitingBattles: number
    flaggedPlayers: { id: string; username: string; flaggedAnswers: number }[]
  }
  playerPagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    search: string
    attentionOnly: boolean
    sort: 'lastPlayedAt' | 'flaggedAnswers' | 'battlesPlayed' | 'rating' | 'accuracy'
    direction: 'asc' | 'desc'
  }
  players: DashboardPlayer[]
  recentBattles: RecentBattle[]
}

function formatNumber(value: number) {
  return value.toLocaleString()
}

function formatPercent(value: number) {
  return `${value}%`
}

function formatMs(value: number | null) {
  if (!value) return '-'
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`
  return `${value}ms`
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function changePercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 'Sin cambio' : 'Nuevo'
  const value = Math.round(((current - previous) / previous) * 100)
  return `${value > 0 ? '+' : ''}${value}% vs. periodo anterior`
}

const FUNNEL_LABELS: Record<string, string> = {
  lobby_viewed: 'Lobby',
  matchmaking_started: 'Matchmaking',
  match_found: 'Partida encontrada',
  battle_started: 'Partida iniciada',
  battle_finished: 'Partida terminada',
  results_viewed: 'Resultados',
  recommended_practice_clicked: 'Práctica recomendada',
  practice_started: 'Práctica iniciada',
  practice_finished: 'Práctica terminada',
}

function statusClass(status: string) {
  if (status === 'active') return 'bg-amber-500/15 text-amber-200 border-amber-500/30'
  if (status === 'finished') return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
  if (status === 'waiting') return 'bg-sky-500/15 text-sky-200 border-sky-500/30'
  return 'bg-white/10 text-white/60 border-white/10'
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/55">{detail}</p>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [sort, setSort] = useState<DashboardData['playerPagination']['sort']>('lastPlayedAt')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setError('')
      try {
        const params = new URLSearchParams({
          search: deferredSearch,
          attention: String(attentionOnly),
          sort,
          direction,
          page: String(page),
        })

        const response = await fetch(`/api/admin/dashboard?${params}`, { cache: 'no-store' })

        if (cancelled) return

        if (response.status === 403) {
          router.push('/lobby')
          return
        }

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          setError(body?.error ?? 'No se pudo cargar el panel de administración.')
          return
        }

        setDashboard((await response.json()) as DashboardData)
      } catch {
        if (!cancelled) setError('No se pudo conectar con el panel de administración.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [attentionOnly, deferredSearch, direction, page, router, sort])

  async function refreshDashboard() {
    setRefreshing(true)
    try {
      const params = new URLSearchParams({
        search: deferredSearch,
        attention: String(attentionOnly),
        sort,
        direction,
        page: String(page),
      })
      const response = await fetch(`/api/admin/dashboard?${params}`, { cache: 'no-store' })

      if (response.status === 403) {
        router.push('/lobby')
        return
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setActionMessage(body?.error ?? 'No se pudo refrescar el panel.')
        return
      }

      setDashboard((await response.json()) as DashboardData)
    } catch {
      setActionMessage('No se pudo conectar con el panel de administración.')
    } finally {
      setRefreshing(false)
    }
  }

  async function runCleanup() {
    if (!window.confirm(
      `Se revisarán y cerrarán las partidas obsoletas detectadas (${alerts.staleActiveBattles} activas y ${alerts.staleWaitingBattles} en espera). ¿Continuar?`
    )) return

    setActionBusy(true)
    setActionMessage('')

    try {
      const response = await fetch('/api/admin/battles/cleanup', { method: 'POST' })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        setActionMessage(body?.error ?? 'No se pudo ejecutar el cleanup.')
        return
      }

      const closed = typeof body?.closed === 'number' ? body.closed : 0
      setActionMessage(`Cleanup completado: ${closed} partidas cerradas.`)
      await refreshDashboard()
    } finally {
      setActionBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-white/70">Cargando panel de admin...</div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-6">
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-center">
          <h1 className="text-lg font-bold text-white">Panel de administración</h1>
          <p className="mt-2 text-sm text-red-100">{error || 'No hay datos disponibles.'}</p>
          <Link
            href="/lobby"
            className="mt-4 inline-flex rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
          >
            Volver al juego
          </Link>
        </div>
      </div>
    )
  }

  const { summary, trends, funnel, alerts, playerPagination, players, recentBattles } = dashboard
  const hasAlerts =
    summary.flaggedAnswers > 0 ||
    alerts.staleActiveBattles > 0 ||
    alerts.staleWaitingBattles > 0

  return (
    <div className="min-h-screen bg-gray-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Math Battle Arena</p>
            <h1 className="mt-1 text-3xl font-bold">Panel de administración</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Actividad de jugadores, estado operativo y señales que requieren revisión.
            </p>
            <p className="mt-2 text-xs text-white/35">Actualizado {formatDate(dashboard.refreshedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={refreshing || actionBusy}
              className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
            <button
              type="button"
              onClick={runCleanup}
              disabled={actionBusy || (alerts.staleActiveBattles === 0 && alerts.staleWaitingBattles === 0)}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionBusy ? 'Cerrando...' : 'Cerrar partidas obsoletas'}
            </button>
            <Link
              href="/admin/cards"
              className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Cartas
            </Link>
            <Link
              href="/admin/flagged"
              className="rounded-lg border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/25"
            >
              Revisar alertas
            </Link>
            <Link
              href="/lobby"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Volver
            </Link>
          </div>
        </div>

        {actionMessage && (
          <div role="status" className="mb-6 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/75">
            {actionMessage}
          </div>
        )}

        <section className={`mb-6 rounded-lg border p-4 ${hasAlerts ? 'border-amber-400/30 bg-amber-500/10' : 'border-emerald-400/20 bg-emerald-500/10'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">Requiere atención</p>
              <h2 className="mt-1 text-lg font-bold">{hasAlerts ? 'Hay elementos pendientes' : 'Todo en orden'}</h2>
            </div>
            {summary.flaggedAnswers > 0 && (
              <Link href="/admin/flagged" className="rounded-lg bg-white px-4 py-2 text-center text-sm font-bold text-gray-950 hover:bg-white/90">
                Revisar {formatNumber(summary.flaggedAnswers)} respuestas
              </Link>
            )}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <p className="rounded-lg bg-black/15 px-3 py-2 text-sm">{formatNumber(summary.flaggedAnswers)} respuestas marcadas</p>
            <p className="rounded-lg bg-black/15 px-3 py-2 text-sm">{formatNumber(alerts.staleActiveBattles)} partidas activas obsoletas</p>
            <p className="rounded-lg bg-black/15 px-3 py-2 text-sm">{formatNumber(alerts.staleWaitingBattles)} partidas esperando demasiado</p>
          </div>
        </section>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Jugadores"
            value={formatNumber(summary.activePlayers)}
            detail={`${formatNumber(summary.activePlayersLast7Days)} activos en 7 días / ${formatNumber(summary.realPlayers)} reales`}
          />
          <StatCard
            label="Partidas"
            value={formatNumber(summary.totalBattles)}
            detail={`${formatNumber(summary.finishedBattles)} finalizadas, ${formatNumber(summary.activeBattles)} activas`}
          />
          <StatCard
            label="Respuestas"
            value={formatNumber(summary.answers)}
            detail={`${formatPercent(summary.accuracy)} acierto medio, ${formatMs(summary.averageResponseMs)} respuesta`}
          />
          <StatCard
            label="Revisión"
            value={formatNumber(summary.flaggedAnswers)}
            detail={`${formatNumber(summary.queueSize)} en cola, ${formatNumber(summary.waitingBattles)} esperando`}
          />
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">Tipos de partida</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(summary.pvpBattles)}</p>
                <p className="text-xs text-white/45">PvP</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(summary.botBattles)}</p>
                <p className="text-xs text-white/45">Bot</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(summary.practiceBattles)}</p>
                <p className="text-xs text-white/45">Práctica</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">Últimos 7 días</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(trends?.current.battles ?? summary.battlesLast7Days)}</p>
                <p className="text-xs text-white/45">Partidas</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(trends?.current.finishedBattles ?? summary.finishedBattles)}</p>
                <p className="text-xs text-white/45">Finalizadas</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(trends?.current.answers ?? summary.answersLast7Days)}</p>
                <p className="text-xs text-white/45">Respuestas</p>
              </div>
            </div>
            {trends && (
              <p className="mt-3 text-xs text-white/40">{changePercent(trends.current.battles, trends.previous.battles)}</p>
            )}
          </div>

          <div className={`rounded-lg border p-4 ${hasAlerts ? 'border-amber-400/30 bg-amber-500/10' : 'border-emerald-400/20 bg-emerald-500/10'}`}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">Estado operativo</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p className={summary.flaggedAnswers > 0 ? 'text-amber-100' : 'text-emerald-100'}>
                {formatNumber(summary.flaggedAnswers)} respuestas marcadas para revisar.
              </p>
              <p className={alerts.staleActiveBattles > 0 ? 'text-amber-100' : 'text-emerald-100'}>
                {formatNumber(alerts.staleActiveBattles)} partidas activas antiguas.
              </p>
              <p className={alerts.staleWaitingBattles > 0 ? 'text-amber-100' : 'text-emerald-100'}>
                {formatNumber(alerts.staleWaitingBattles)} partidas esperando demasiado.
              </p>
            </div>
          </div>
        </div>

        {funnel.length > 0 && (
          <section className="mb-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Funnel de los últimos 7 días</h2>
                <p className="text-sm text-white/50">Jugadores únicos que alcanzaron cada paso.</p>
              </div>
              <p className="text-xs text-white/35">Datos de product_events</p>
            </div>
            <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3 lg:grid-cols-5">
              {funnel.map(step => (
                <div key={step.eventName} className="bg-gray-950 px-3 py-3">
                  <p className="text-xl font-bold text-white">{formatNumber(step.players)}</p>
                  <p className="mt-1 text-xs text-white/45">{FUNNEL_LABELS[step.eventName] ?? step.eventName}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-6 rounded-lg border border-white/10 bg-white/[0.04]">
          <div className="border-b border-white/10 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Jugadores con actividad</h2>
              <p className="text-sm text-white/50">Busca y compara actividad, rendimiento e incidencias.</p>
            </div>
            <p className="text-xs text-white/35">
              {formatNumber(playerPagination.total)} resultados
            </p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_130px_auto]">
              <label className="sr-only" htmlFor="player-search">Buscar jugador</label>
              <input
                id="player-search"
                type="search"
                value={search}
                onChange={event => { setSearch(event.target.value); setPage(1) }}
                placeholder="Buscar por username"
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/50"
              />
              <label className="sr-only" htmlFor="player-sort">Ordenar jugadores</label>
              <select
                id="player-sort"
                value={sort}
                onChange={event => { setSort(event.target.value as typeof sort); setPage(1) }}
                className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
              >
                <option value="lastPlayedAt">Actividad reciente</option>
                <option value="flaggedAnswers">Respuestas marcadas</option>
                <option value="battlesPlayed">Partidas</option>
                <option value="rating">PvP Rating</option>
                <option value="accuracy">Acierto</option>
              </select>
              <button
                type="button"
                onClick={() => { setDirection(current => current === 'desc' ? 'asc' : 'desc'); setPage(1) }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
              >
                {direction === 'desc' ? 'Mayor primero' : 'Menor primero'}
              </button>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={attentionOnly}
                  onChange={event => { setAttentionOnly(event.target.checked); setPage(1) }}
                  className="h-4 w-4 accent-amber-400"
                />
                Solo incidencias
              </label>
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">Última vez</th>
                  <th className="px-4 py-3 text-right">Partidas</th>
                  <th className="px-4 py-3 text-right">PvP/Bot/Práctica</th>
                  <th className="px-4 py-3 text-right">Respuestas</th>
                  <th className="px-4 py-3 text-right">Acierto</th>
                  <th className="px-4 py-3 text-right">Tiempo</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                  <th className="px-4 py-3 text-right">PvP Rating</th>
                  <th className="px-4 py-3 text-right">W/L</th>
                  <th className="px-4 py-3 text-right">Cartas</th>
                  <th className="px-4 py-3 text-right">Marcadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {players.map(player => (
                  <tr key={player.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link href={`/profile/${player.id}`} className="font-semibold text-white hover:text-cyan-200">
                        {player.username}
                      </Link>
                      <p className="text-xs text-white/40">Lv.{player.level} - {player.rankTitle}</p>
                    </td>
                    <td className="px-4 py-3 text-white/65">{formatDate(player.lastPlayedAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(player.battlesPlayed)}</td>
                    <td className="px-4 py-3 text-right text-white/65">
                      {formatNumber(player.pvpBattles)} / {formatNumber(player.botBattles)} / {formatNumber(player.practiceBattles)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(player.answers)}</td>
                    <td className="px-4 py-3 text-right">{formatPercent(player.accuracy)}</td>
                    <td className="px-4 py-3 text-right">{formatMs(player.avgResponseMs)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold">{formatNumber(player.totalPoints)}</span>
                      <p className="text-xs text-white/35">{formatNumber(player.pointsBalance)} saldo</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(player.rating)}</td>
                    <td className="px-4 py-3 text-right text-white/65">
                      {formatNumber(player.profileWins)} / {formatNumber(player.profileLosses)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(player.cardsOwned)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${player.flaggedAnswers > 0 ? 'text-red-300' : 'text-white/40'}`}>
                      {formatNumber(player.flaggedAnswers)}
                    </td>
                  </tr>
                ))}
                {players.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-white/45">
                      No hay jugadores que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-white/10 md:hidden">
            {players.map(player => (
              <article key={player.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/profile/${player.id}`} className="truncate font-bold text-white hover:text-cyan-200">
                      {player.username}
                    </Link>
                    <p className="text-xs text-white/40">Nivel {player.level} · {player.rankTitle}</p>
                  </div>
                  {player.flaggedAnswers > 0 && (
                    <span className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-bold text-red-200">
                      {player.flaggedAnswers} marcadas
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] text-white/40">Partidas</dt><dd className="font-bold">{player.battlesPlayed}</dd></div>
                  <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] text-white/40">Acierto</dt><dd className="font-bold">{formatPercent(player.accuracy)}</dd></div>
                  <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] text-white/40">Rating</dt><dd className="font-bold">{player.rating}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-white/45">Última actividad: {formatDate(player.lastPlayedAt)}</p>
              </article>
            ))}
            {players.length === 0 && <p className="p-8 text-center text-sm text-white/45">No hay jugadores que coincidan con los filtros.</p>}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
            <p className="text-xs text-white/40">
              Página {playerPagination.page} de {playerPagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={playerPagination.page <= 1}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-30"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage(current => Math.min(playerPagination.totalPages, current + 1))}
                disabled={playerPagination.page >= playerPagination.totalPages}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-30"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-lg font-bold">Partidas recientes</h2>
              <p className="text-sm text-white/50">Últimas sesiones creadas, con resultado y tipo.</p>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[850px] w-full text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
                  <tr>
                    <th className="px-4 py-3">Partida</th>
                    <th className="px-4 py-3">Jugadores</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Score</th>
                    <th className="px-4 py-3">Ganador</th>
                    <th className="px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {recentBattles.map(battle => (
                    <tr key={battle.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${statusClass(battle.status)}`}>
                          {battle.status}
                        </span>
                        <p className="mt-1 text-xs text-white/35">{battle.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {battle.hostName}
                        <span className="text-white/30"> vs </span>
                        {battle.guestName}
                      </td>
                      <td className="px-4 py-3 text-white/65">
                        <span className="font-semibold text-white">{battle.kind}</span>
                        <p className="text-xs text-white/35">{battle.mode} - {battle.difficulty} - {battle.questionCount}q</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatNumber(battle.hostScore)} - {formatNumber(battle.guestScore)}
                      </td>
                      <td className="px-4 py-3 text-white/65">{battle.winnerName ?? '-'}</td>
                      <td className="px-4 py-3 text-white/65">{formatDate(battle.finishedAt ?? battle.startedAt ?? battle.createdAt)}</td>
                    </tr>
                  ))}
                  {recentBattles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-white/45">
                        No hay partidas registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-white/10 md:hidden">
              {recentBattles.map(battle => (
                <article key={battle.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{battle.hostName} <span className="text-white/30">vs.</span> {battle.guestName}</p>
                      <p className="mt-1 text-xs text-white/40">{battle.kind} · {battle.difficulty} · {battle.questionCount} preguntas</p>
                    </div>
                    <span className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold ${statusClass(battle.status)}`}>
                      {battle.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold">{battle.hostScore}–{battle.guestScore}</p>
                      <p className="text-xs text-white/45">Ganador: {battle.winnerName ?? '—'}</p>
                    </div>
                    <p className="text-right text-xs text-white/45">{formatDate(battle.finishedAt ?? battle.startedAt ?? battle.createdAt)}</p>
                  </div>
                </article>
              ))}
              {recentBattles.length === 0 && <p className="p-8 text-center text-sm text-white/45">No hay partidas registradas.</p>}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-lg font-bold">Catálogo</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xl font-bold">{formatNumber(summary.totalCards)}</p>
                  <p className="text-xs text-white/45">Cartas</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xl font-bold">{formatNumber(summary.activeCards)}</p>
                  <p className="text-xs text-white/45">Activas</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-lg font-bold">Jugadores con flags</h2>
              <div className="mt-3 space-y-2">
                {alerts.flaggedPlayers.map(player => (
                  <Link
                    key={player.id}
                    href={`/profile/${player.id}`}
                    className="flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2 text-sm hover:bg-red-500/15"
                  >
                    <span className="font-semibold text-red-100">{player.username}</span>
                    <span className="text-red-200">{formatNumber(player.flaggedAnswers)}</span>
                  </Link>
                ))}
                {alerts.flaggedPlayers.length === 0 && (
                  <p className="rounded-lg bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
                    Sin jugadores marcados ahora mismo.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}
