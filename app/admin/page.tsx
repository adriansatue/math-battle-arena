'use client'

import { useEffect, useState } from 'react'
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
  summary: DashboardSummary
  alerts: {
    staleActiveBattles: number
    staleWaitingBattles: number
    flaggedPlayers: { id: string; username: string; flaggedAnswers: number }[]
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
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState<'cleanup' | 'flags' | null>(null)
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setError('')

      const response = await fetch('/api/admin/dashboard', { cache: 'no-store' })

      if (cancelled) return

      if (response.status === 403) {
        router.push('/lobby')
        return
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? 'No se pudo cargar el panel de admin.')
        setLoading(false)
        return
      }

      const data = (await response.json()) as DashboardData
      setDashboard(data)
      setLoading(false)
    }

    loadDashboard()

    return () => {
      cancelled = true
    }
  }, [router])

  async function refreshDashboard() {
    const response = await fetch('/api/admin/dashboard', { cache: 'no-store' })

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
  }

  async function runCleanup() {
    setActionBusy('cleanup')
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
      setActionBusy(null)
    }
  }

  async function clearFlags() {
    setActionBusy('flags')
    setActionMessage('')

    try {
      const response = await fetch('/api/admin/flagged', { method: 'PATCH' })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        setActionMessage(body?.error ?? 'No se pudieron limpiar los flags.')
        return
      }

      setActionMessage('Flags limpiados correctamente.')
      await refreshDashboard()
    } finally {
      setActionBusy(null)
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
          <h1 className="text-lg font-bold text-white">Admin panel</h1>
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

  const { summary, alerts, players, recentBattles } = dashboard
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
            <h1 className="mt-1 text-3xl font-bold">Admin Panel</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Actividad real de jugadores, partidas, respuestas, rendimiento y senales de revision.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runCleanup}
              disabled={actionBusy !== null}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionBusy === 'cleanup' ? 'Cerrando...' : 'Run cleanup'}
            </button>
            <button
              type="button"
              onClick={clearFlags}
              disabled={actionBusy !== null || summary.flaggedAnswers === 0}
              className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionBusy === 'flags' ? 'Limpiando...' : 'Clear flags'}
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
              Flags
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
          <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/75">
            {actionMessage}
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Jugadores"
            value={formatNumber(summary.activePlayers)}
            detail={`${formatNumber(summary.activePlayersLast7Days)} activos en 7 dias / ${formatNumber(summary.realPlayers)} reales`}
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
            label="Revision"
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
                <p className="text-xs text-white/45">Practica</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">Ultimos 7 dias</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(summary.battlesLast7Days)}</p>
                <p className="text-xs text-white/45">Partidas</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(summary.answersLast7Days)}</p>
                <p className="text-xs text-white/45">Respuestas</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-xl font-bold">{formatNumber(summary.inventoryCards)}</p>
                <p className="text-xs text-white/45">Cartas jugador</p>
              </div>
            </div>
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

        <section className="mb-6 rounded-lg border border-white/10 bg-white/[0.04]">
          <div className="flex flex-col gap-1 border-b border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Jugadores con actividad</h2>
              <p className="text-sm text-white/50">Ordenados por actividad reciente y puntos.</p>
            </div>
            <p className="text-xs text-white/35">Mostrando hasta 30 jugadores</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">Ultima vez</th>
                  <th className="px-4 py-3 text-right">Partidas</th>
                  <th className="px-4 py-3 text-right">PvP/Bot/Practica</th>
                  <th className="px-4 py-3 text-right">Respuestas</th>
                  <th className="px-4 py-3 text-right">Acierto</th>
                  <th className="px-4 py-3 text-right">Tiempo</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                  <th className="px-4 py-3 text-right">PvP Rating</th>
                  <th className="px-4 py-3 text-right">W/L</th>
                  <th className="px-4 py-3 text-right">Cartas</th>
                  <th className="px-4 py-3 text-right">Flags</th>
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
                      Todavia no hay jugadores con partidas o respuestas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-lg font-bold">Partidas recientes</h2>
              <p className="text-sm text-white/50">Ultimas sesiones creadas, con resultado y tipo.</p>
            </div>
            <div className="overflow-x-auto">
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
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-lg font-bold">Catalogo</h2>
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
