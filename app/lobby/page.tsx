'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SwordLogo } from '@/components/SwordLogo'
import { timeLimits } from '@/lib/game/questions'
import { recordClientEvent } from '@/lib/events/client'
import { DailyObjectivesPanel } from '@/components/lobby/DailyObjectivesPanel'
import { NewsletterConsentPrompt } from '@/components/lobby/NewsletterConsentPrompt'

type Mode = 'realtime' | 'turnbased'
type Difficulty = 'easy' | 'medium' | 'hard'

type PlayerSnapshot = {
  username: string | null
  level: number | null
  rank_title: string | null
  rating: number | null
  total_points: number | null
  points_balance: number | null
}

type IconProps = {
  className?: string
}

const BOT_OFFER_SECONDS = 5
const DIFFICULTIES: Record<Difficulty, {
  label: string
  detail: string
  accent: string
}> = {
  easy: {
    label:  'Easy',
    detail: 'Warm-up pace',
    accent: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  },
  medium: {
    label:  'Medium',
    detail: 'Balanced race',
    accent: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  },
  hard: {
    label:  'Hard',
    detail: 'Fast answers',
    accent: 'border-rose-300/40 bg-rose-400/15 text-rose-100',
  },
}

function formatNumber(value: number | null | undefined) {
  return (value ?? 0).toLocaleString()
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function LobbyPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const mode = 'realtime' as Mode
  const queueMode = 'realtime' as Mode
  const questions = 10

  const [profile, setProfile] = useState<PlayerSnapshot | null>(null)
  const [friendPanel, setFriendPanel] = useState<null | 'create' | 'join'>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [queueDiff, setQueueDiff] = useState<Difficulty>('medium')
  const [creating, setCreating] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [battleId, setBattleId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [inQueue, setInQueue] = useState(false)
  const [startingBot, setStartingBot] = useState(false)
  const [queueTime, setQueueTime] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const queueTimeRef = useRef(0)
  const queueInterval = useRef<NodeJS.Timeout | null>(null)
  const pollInterval = useRef<NodeJS.Timeout | null>(null)
  const battleTransition = useRef(false)

  useEffect(() => {
    void recordClientEvent('lobby_viewed')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data } = await supabase
        .from('profiles')
        .select('username, level, rank_title, rating, total_points, points_balance')
        .eq('id', user.id)
        .single()

      if (!cancelled) setProfile(data as PlayerSnapshot | null)
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    return () => {
      if (queueInterval.current) clearInterval(queueInterval.current)
      if (pollInterval.current) clearInterval(pollInterval.current)
    }
  }, [])

  useEffect(() => {
    const handleUnload = () => {
      void fetch('/api/matchmaking/queue', { method: 'DELETE', keepalive: true })
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  function stopQueueTimers() {
    if (queueInterval.current) clearInterval(queueInterval.current)
    if (pollInterval.current) clearInterval(pollInterval.current)
    queueInterval.current = null
    pollInterval.current = null
  }

  async function createBattle() {
    setCreating(true)
    setError(null)
    setCopied(false)

    const res = await fetch('/api/battles', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode, difficulty, question_count: questions }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setCreating(false)
      return
    }

    setInviteCode(data.battle.invite_code)
    setBattleId(data.battle.id)
    setCreating(false)
  }

  function goToBattle() {
    if (battleId) router.push(`/battle/${battleId}`)
  }

  async function copyInviteCode() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function joinByCode() {
    if (joinCode.length < 6) return
    setJoining(true)
    setError(null)

    const res = await fetch('/api/battles/join', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ invite_code: joinCode }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setJoining(false)
      return
    }

    router.push(`/battle/${data.battle_id}`)
  }

  async function joinQueue() {
    if (inQueue || startingBot || battleTransition.current) return
    setInQueue(true)
    setQueueTime(0)
    queueTimeRef.current = 0
    setError(null)

    queueInterval.current = setInterval(() => {
      setQueueTime(prev => {
        queueTimeRef.current = prev + 1
        return prev + 1
      })
    }, 1000)

    const res = await fetch('/api/matchmaking/queue', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode: queueMode, difficulty: queueDiff }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      await leaveQueue()
      return
    }

    if (data.matched) {
      battleTransition.current = true
      await leaveQueue()
      router.push(`/battle/${data.battle_id}`)
      return
    }

    pollInterval.current = setInterval(async () => {
      if (battleTransition.current) return

      const checkRes = await fetch('/api/matchmaking/queue').catch(() => null)
      if (!checkRes?.ok) return
      const checkData = await checkRes.json()

      if (checkData.matched) {
        battleTransition.current = true
        await leaveQueue()
        router.push(`/battle/${checkData.battle_id}`)
      }
    }, 1000)
  }

  async function startBotBattle(checkForMatch = false) {
    if (startingBot || battleTransition.current) return
    battleTransition.current = true
    setStartingBot(true)
    setError(null)

    try {
      if (checkForMatch) {
        const finalCheckRes = await fetch('/api/matchmaking/queue')
        const finalCheckData = await finalCheckRes.json().catch(() => ({}))
        if (finalCheckRes.ok && finalCheckData.matched) {
          stopQueueTimers()
          setInQueue(false)
          router.push(`/battle/${finalCheckData.battle_id}`)
          return
        }
      }

      stopQueueTimers()
      const botRes = await fetch('/api/matchmaking/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: queueMode,
          difficulty: queueDiff,
          bot_difficulty: queueDiff,
        }),
      })
      const botData = await botRes.json().catch(() => ({}))
      if (!botRes.ok || !botData.battle_id) {
        throw new Error(botData.error ?? 'Failed to start bot battle')
      }

      setInQueue(false)
      router.push(`/battle/${botData.battle_id}`)
    } catch (err) {
      console.error('[startBotBattle] error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start bot battle')
      setInQueue(false)
      setQueueTime(0)
      queueTimeRef.current = 0
      battleTransition.current = false
      setStartingBot(false)
    }
  }

  async function leaveQueue() {
    stopQueueTimers()
    setInQueue(false)
    setQueueTime(0)
    queueTimeRef.current = 0
    if (!battleTransition.current) setStartingBot(false)
    try {
      await fetch('/api/matchmaking/queue', { method: 'DELETE' })
    } catch {
      // Best-effort cleanup.
    }
  }

  const botAvailable = queueTime >= BOT_OFFER_SECONDS
  const selectedFriendDifficulty = DIFFICULTIES[difficulty]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 px-4 pb-16 pt-4 text-white sm:px-6 sm:pb-8">
      <div className="mx-auto grid w-full max-w-3xl gap-3">
        <header>
          <div className="rounded-2xl border border-purple-300/20 bg-white/10 p-3 shadow-xl shadow-purple-950/25 backdrop-blur-sm sm:p-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 drop-shadow-xl">
                <SwordLogo className="h-12 w-12 sm:h-14 sm:w-14" id="lobby-hero" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-300">Play</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Choose Your Battle</h1>
              </div>
              <div className="hidden grid-cols-3 gap-2 sm:grid">
                <PlayerMetric label="Level" value={formatNumber(profile?.level ?? 1)} />
                <PlayerMetric label="PvP Rating" value={formatNumber(profile?.rating ?? 1000)} />
                <PlayerMetric label="Coins" value={formatNumber(profile?.points_balance ?? profile?.total_points ?? 0)} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
              <PlayerMetric label="Level" value={formatNumber(profile?.level ?? 1)} />
              <PlayerMetric label="PvP Rating" value={formatNumber(profile?.rating ?? 1000)} />
              <PlayerMetric label="Coins" value={formatNumber(profile?.points_balance ?? profile?.total_points ?? 0)} />
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-100 shadow-lg shadow-red-950/20">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-purple-300/25 bg-purple-500/15 p-4 shadow-xl shadow-purple-950/25 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BoltIcon className="h-5 w-5 text-pink-200" />
                <h2 className="text-lg font-black">Quick Battle</h2>
              </div>
              <p className="mt-0.5 text-xs text-purple-100/65">
                Match by PvP rating and level, or start instantly against AI
              </p>
            </div>
            <span className="rounded-lg border border-white/10 bg-black/15 px-2.5 py-1 text-xs font-bold text-purple-100/70">
              10 questions
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map(diff => {
              const option = DIFFICULTIES[diff]
              const selected = queueDiff === diff
              return (
                <button
                  key={diff}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setQueueDiff(diff)}
                  disabled={inQueue}
                  className={`rounded-xl border px-2 py-2 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? option.accent
                      : 'border-white/10 bg-white/5 text-purple-100/65 hover:border-purple-200/30 hover:bg-white/10'
                  }`}
                >
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] opacity-70">{timeLimits[diff]}s / question</span>
                </button>
              )
            })}
          </div>

          {inQueue ? (
            <div aria-live="polite" className="mt-4 rounded-2xl border border-purple-200/15 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 rounded-full border border-pink-300/30 bg-pink-300/10">
                    <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-200" />
                    <div className="absolute inset-1 rounded-full border border-pink-200/30 animate-ping" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      Finding a fair opponent
                    </p>
                    <p className="text-xs text-purple-100/55">
                      {queueTime < 10 ? 'Searching near your rating and level' : 'Expanding the search range'}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm text-pink-100">{formatTime(queueTime)}</span>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {botAvailable && (
                  <button
                    type="button"
                    onClick={() => startBotBattle(true)}
                    disabled={startingBot}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
                  >
                    <BotIcon className="h-4 w-4" />
                    {startingBot ? 'Starting...' : 'Play bot now'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={leaveQueue}
                  disabled={startingBot}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <CloseIcon className="h-4 w-4" />
                  Cancel search
                </button>
              </div>
              {!botAvailable && (
                <p className="mt-3 text-xs text-purple-100/45">AI option available in {BOT_OFFER_SECONDS - queueTime}s</p>
              )}
            </div>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr]">
              <button
                type="button"
                onClick={joinQueue}
                disabled={startingBot}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/30 transition hover:from-purple-400 hover:to-pink-400 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
              >
                <BoltIcon className="h-5 w-5" />
                Find player
              </button>
              <Link
                href="/bot-campaign"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/20 disabled:opacity-60"
              >
                <BotIcon className="h-5 w-5" />
                Bot campaign
              </Link>
            </div>
          )}
        </section>

        <NewsletterConsentPrompt />

        <DailyObjectivesPanel
          onBalanceChange={balance => setProfile(current => current
            ? { ...current, points_balance: balance }
            : current)}
        />

        <section className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-xl shadow-purple-950/20 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-purple-200" />
                <h2 className="text-lg font-black">Play a Friend</h2>
              </div>
              <p className="mt-1 text-sm text-purple-100/65">Create a room or join with a 6-character code.</p>
            </div>
            <span className={`rounded-xl border px-3 py-1 text-xs font-bold ${selectedFriendDifficulty.accent}`}>
              {selectedFriendDifficulty.label}
            </span>
          </div>

          {friendPanel === null && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFriendPanel('create')
                  setInviteCode(null)
                  setBattleId(null)
                  setCopied(false)
                }}
                className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left transition hover:border-purple-300/40 hover:bg-purple-400/15"
              >
                <PlusIcon className="mb-3 h-5 w-5 text-purple-200" />
                <span className="block text-sm font-black">Create Game</span>
                <span className="mt-1 block text-xs text-purple-100/55">Invite by code</span>
              </button>
              <button
                type="button"
                onClick={() => setFriendPanel('join')}
                className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left transition hover:border-pink-300/40 hover:bg-pink-400/15"
              >
                <JoinIcon className="mb-3 h-5 w-5 text-pink-200" />
                <span className="block text-sm font-black">Join Room</span>
                <span className="mt-1 block text-xs text-purple-100/55">Enter a code</span>
              </button>
            </div>
          )}

          {friendPanel === 'create' && (
            <div className="mt-4 space-y-3">
              {!inviteCode && (
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(DIFFICULTIES) as Difficulty[]).map(diff => {
                    const option = DIFFICULTIES[diff]
                    const selected = difficulty === diff
                    return (
                      <button
                        key={diff}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setDifficulty(diff)}
                        className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                          selected
                            ? option.accent
                            : 'border-white/10 bg-white/5 text-purple-100/60 hover:bg-white/10'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {inviteCode ? (
                <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Room Code</p>
                  <p className="mt-2 font-mono text-3xl font-black tracking-[0.22em] text-white">{inviteCode}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={copyInviteCode}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/20 bg-white/10 px-3 py-3 text-sm font-bold text-emerald-50 hover:bg-white/15"
                    >
                      <CopyIcon className="h-4 w-4" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={goToBattle}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-3 py-3 text-sm font-black text-slate-950 hover:bg-emerald-200"
                    >
                      <PlayIcon className="h-4 w-4" />
                      Enter
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFriendPanel(null)}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                    aria-label="Back"
                  >
                    <BackIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={createBattle}
                    disabled={creating}
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-purple-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {creating ? 'Creating...' : 'Create Battle'}
                  </button>
                </div>
              )}
            </div>
          )}

          {friendPanel === 'join' && (
            <div className="mt-5 space-y-3">
              <input
                type="text"
                value={joinCode}
                onChange={event => setJoinCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6))}
                onKeyDown={event => {
                  if (event.key === 'Enter' && joinCode.length === 6 && !joining) void joinByCode()
                }}
                placeholder="X4K9PZ"
                maxLength={6}
                aria-label="6-character room code"
                className="h-12 w-full rounded-2xl border border-white/15 bg-black/20 px-4 text-center font-mono text-2xl font-black tracking-[0.22em] text-white placeholder:text-white/15 focus:border-purple-300/70 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFriendPanel(null)}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                  aria-label="Back"
                >
                  <BackIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={joinByCode}
                  disabled={joining || joinCode.length < 6}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-purple-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <JoinIcon className="h-4 w-4" />
                  {joining ? 'Joining...' : 'Join Battle'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-xl shadow-purple-950/20 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">More Ways to Play</h2>
              <p className="mt-1 text-sm text-purple-100/60">Practice, compare ranks, or open your card collection.</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <Link
              href="/practice"
              className="group rounded-xl border border-white/10 bg-white/5 p-3 text-center transition hover:border-emerald-300/30 hover:bg-emerald-400/10 sm:text-left"
            >
              <TargetIcon className="mx-auto h-5 w-5 text-emerald-200 sm:mx-0" />
              <h3 className="mt-2 text-sm font-black sm:text-base">Practice</h3>
              <p className="mt-0.5 hidden text-sm text-purple-100/55 sm:block">Solo drills by topic</p>
            </Link>
            <Link
              href="/leaderboard"
              className="group rounded-xl border border-white/10 bg-white/5 p-3 text-center transition hover:border-amber-300/30 hover:bg-amber-400/10 sm:text-left"
            >
              <RanksIcon className="mx-auto h-5 w-5 text-amber-200 sm:mx-0" />
              <h3 className="mt-2 text-sm font-black sm:text-base">Ranks</h3>
              <p className="mt-0.5 hidden text-sm text-purple-100/55 sm:block">Compare rating and XP</p>
            </Link>
            <Link
              href="/rewards"
              className="group rounded-xl border border-white/10 bg-white/5 p-3 text-center transition hover:border-pink-300/30 hover:bg-pink-400/10 sm:text-left"
            >
              <CardsIcon className="mx-auto h-5 w-5 text-pink-200 sm:mx-0" />
              <h3 className="mt-2 text-sm font-black sm:text-base">Cards</h3>
              <p className="mt-0.5 hidden text-sm text-purple-100/55 sm:block">Open packs and collect</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function PlayerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-100/45">{label}</p>
      <p className="mt-0.5 text-base font-black text-white">{value}</p>
    </div>
  )
}

function BoltIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m13 2-8 11h6l-1 9 9-12h-6z" />
    </svg>
  )
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 20a4 4 0 0 0-8 0" />
      <circle cx="12" cy="9" r="3" />
      <path d="M22 19a3.5 3.5 0 0 0-5-3.1" />
      <path d="M2 19a3.5 3.5 0 0 1 5-3.1" />
      <path d="M18 7.5a2.5 2.5 0 0 1 0 5" />
      <path d="M6 7.5a2.5 2.5 0 0 0 0 5" />
    </svg>
  )
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function JoinIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17H6a4 4 0 0 1 0-8h4" />
      <path d="M14 7h4a4 4 0 0 1 0 8h-4" />
      <path d="M8 12h8" />
    </svg>
  )
}

function CopyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M8 5.5v13l10-6.5z" />
    </svg>
  )
}

function BackIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function BotIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4" />
      <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
      <path d="M9 16h6" />
    </svg>
  )
}

function TargetIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </svg>
  )
}

function RanksIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19v-6h4v6" />
      <path d="M10 19V7h4v12" />
      <path d="M15 19v-9h4v9" />
      <path d="M4 19h16" />
    </svg>
  )
}

function CardsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 8h6" />
      <path d="M9 12h3" />
      <path d="m14 15 1 1 2-2" />
    </svg>
  )
}
