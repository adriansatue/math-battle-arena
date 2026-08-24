'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logout, signInWithGoogle, changeUsername } from '@/lib/supabase/actions'
import { MAX_LEVEL, getLevelProgress } from '@/lib/game/progression'
import { getTopicInsight } from '@/lib/game/performance'
import { recordClientEvent } from '@/lib/events/client'
import Image from 'next/image'
import { EmailReminderPreference } from '@/components/profile/EmailReminderPreference'

interface Profile {
  id:                  string
  username:            string
  username_customized: boolean
  total_points:        number
  level:               number
  rank_title:          string
  rating:              number
  points_balance:      number
  wins:                number
  losses:              number
  current_streak:      number
  best_streak:         number
  created_at:          string
}

interface Weakness {
  category:      string
  accuracy_rate: number
  total_attempts: number
  avg_speed_ms:  number
}

interface ShowcaseCard {
  id: string
  grade: number | null
  reward_catalog: {
    name: string
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
    image_url: string
  }
}

const SHOWCASE_STYLE = {
  common: {
    frame: 'border-slate-300/60 bg-slate-400/10 shadow-slate-950/30',
    label: 'text-slate-200',
  },
  uncommon: {
    frame: 'border-emerald-300/70 bg-emerald-400/10 shadow-emerald-950/30',
    label: 'text-emerald-200',
  },
  rare: {
    frame: 'border-cyan-300/75 bg-cyan-400/10 shadow-cyan-950/35',
    label: 'text-cyan-200',
  },
  legendary: {
    frame: 'border-amber-300/80 bg-amber-400/10 shadow-amber-950/40',
    label: 'text-amber-200',
  },
} as const

const GRADE_LABEL: Record<number, string> = {
  10: 'Gem Mint',
  9: 'Mint',
  8: 'NM-MT',
  7: 'Near Mint',
  6: 'EX-MT',
  5: 'Excellent',
}

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
  const supabase = useMemo(() => createClient(), [])

  const [profile,         setProfile]         = useState<Profile | null>(null)
  const [weaknesses,      setWeaknesses]      = useState<Weakness[]>([])
  const [isMe,            setIsMe]            = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAnonymous,     setIsAnonymous]     = useState(false)
  const [email,           setEmail]           = useState<string | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [showcase,        setShowcase]        = useState<ShowcaseCard | null>(null)
  const [emblemImageFailed, setEmblemImageFailed] = useState(false)

  // Username change form state
  const [usernameInput,   setUsernameInput]   = useState('')
  const [usernameMsg,     setUsernameMsg]     = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [linkingGoogle,   setLinkingGoogle]   = useState(false)
  const [linkError,       setLinkError]       = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const isOwner = user?.id === id

      const profileRequest = supabase.from('profiles').select('*').eq('id', id).single()
      const showcaseRequest = fetch(`/api/profile/${id}/showcase`, { cache: 'no-store' })
        .then(async response => response.ok
          ? await response.json() as { showcase: ShowcaseCard | null }
          : { showcase: null })
        .catch(() => ({ showcase: null }))
      const weaknessesRequest = isOwner
        ? supabase
            .from('student_weaknesses')
            .select('*')
            .eq('user_id', id)
            .order('accuracy_rate', { ascending: true })
        : Promise.resolve({ data: null })

      const [{ data: prof }, showcaseData, { data: weaknessData }] = await Promise.all([
        profileRequest,
        showcaseRequest,
        weaknessesRequest,
      ])

      if (cancelled) return

      if (!prof) { router.push('/leaderboard'); return }
      setProfile(prof as Profile)
      setShowcase(showcaseData.showcase)

      if (user) {
        setIsAuthenticated(true)
        setIsAnonymous(Boolean(user.is_anonymous))
        setIsMe(isOwner)
        if (isOwner) setEmail(user.email ?? null)
      }

      if (isOwner) {
        const loadedWeaknesses = (weaknessData as Weakness[]) ?? []
        setWeaknesses(loadedWeaknesses)

        const focus = loadedWeaknesses[0]
        if (focus) {
          const insight = getTopicInsight(focus)
          void recordClientEvent('profile_insight_viewed', undefined, {
            primary_topic: focus.category,
            insight_status: insight.status,
            sample_label: insight.sampleLabel,
          })
        }
      }

      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [id, router, supabase])

  async function linkGoogleAccount() {
    setLinkingGoogle(true)
    setLinkError(null)

    const next = encodeURIComponent(`/profile/${id}`)
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    })

    if (error) {
      setLinkError('Google could not be linked. Please try again or contact support.')
      setLinkingGoogle(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse text-xl">Loading profile...</div>
    </div>
  )

  if (!profile) return null

  const winRate = profile.wins + profile.losses > 0
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
    : 0
  const totalBattles = profile.wins + profile.losses

  const levelProgress = getLevelProgress(profile.total_points)
  const displayLevel = levelProgress.level
  const displayRankTitle = levelProgress.rankTitle

  const levelColor =
    displayLevel >= 91 ? 'from-yellow-500 to-orange-500' :
    displayLevel >= 71 ? 'from-purple-500 to-pink-500'   :
    displayLevel >= 51 ? 'from-blue-500 to-cyan-500'     :
    displayLevel >= 31 ? 'from-green-500 to-teal-500'    :
                         'from-gray-500 to-gray-600'
  const primaryFocus = weaknesses[0]
  const primaryInsight = primaryFocus ? getTopicInsight(primaryFocus) : null
  const showcaseStyle = showcase ? SHOWCASE_STYLE[showcase.reward_catalog.rarity] : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 px-4 pb-16 pt-5 text-white sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <Link href="/leaderboard" className="text-sm font-semibold text-purple-200/70 transition hover:text-white">
            ← Rankings
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-purple-300/55">
            {isMe ? 'My profile' : 'Player profile'}
          </span>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.08] shadow-2xl shadow-purple-950/30 backdrop-blur-sm">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <figure className="w-20 shrink-0 text-center sm:w-24">
                <div
                  className={`relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 shadow-xl sm:h-24 sm:w-24 ${
                    showcaseStyle?.frame ?? `border-white/15 bg-gradient-to-br ${levelColor} shadow-purple-950/30`
                  }`}
                >
                  {showcase?.reward_catalog.image_url && !emblemImageFailed ? (
                    <Image
                      src={showcase.reward_catalog.image_url}
                      alt={`${showcase.reward_catalog.name} player emblem`}
                      fill
                      sizes="(min-width: 640px) 96px, 80px"
                      className="object-contain p-1.5"
                      onError={() => setEmblemImageFailed(true)}
                    />
                  ) : (
                    <span className="text-3xl font-black text-white sm:text-4xl" aria-hidden="true">
                      {profile.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <figcaption className="mt-2 text-[10px] font-bold uppercase tracking-wide text-white/40">
                  Player emblem
                </figcaption>
              </figure>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl">{profile.username}</h1>
                    <p className={`mt-0.5 bg-gradient-to-r ${levelColor} bg-clip-text text-sm font-bold text-transparent`}>
                      {displayRankTitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-white/10 bg-black/15 px-2.5 py-1 text-xs font-black text-white/80">
                    Lv. {displayLevel}
                  </span>
                </div>

                {showcase ? (
                  <div className="mt-2 min-w-0">
                    <p className={`truncate text-sm font-bold ${showcaseStyle?.label}`} title={showcase.reward_catalog.name}>
                      {showcase.reward_catalog.name}
                    </p>
                    <p className="text-xs capitalize text-white/40">
                      {showcase.reward_catalog.rarity}
                      {showcase.grade ? ` · ${GRADE_LABEL[showcase.grade] ?? `Grade ${showcase.grade}`}` : ''}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-white/40">
                    {isMe ? 'Choose a card to make this profile yours.' : 'No card emblem selected.'}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-xs text-white/40">
                    Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                  {isMe && (
                    <Link href="/rewards#collection" className="text-xs font-bold text-cyan-200 transition hover:text-white">
                      {showcase ? 'Change emblem' : 'Choose emblem'} →
                    </Link>
                  )}
                </div>
              </div>
            </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/15 p-3.5">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-200/50">Level progress</p>
                <p className="mt-0.5 text-lg font-black">Level {displayLevel}</p>
              </div>
              <div className="text-right text-xs text-purple-200/65">
                <p>{profile.total_points.toLocaleString()} XP total</p>
                {!levelProgress.isMaxLevel && (
                  <p>{levelProgress.xpToNextLevel.toLocaleString()} XP to Level {displayLevel + 1}</p>
                )}
                {levelProgress.isMaxLevel && <p>Max Level {MAX_LEVEL}</p>}
              </div>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label={`Progress through Level ${displayLevel}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={levelProgress.progressPercent}
            >
              <div
                className={`h-full rounded-full bg-gradient-to-r ${levelColor} transition-all duration-1000`}
                style={{ width: `${levelProgress.progressPercent}%` }}
              />
            </div>
          </div>
          </div>

          <div className="border-t border-white/10 bg-black/10 p-3 sm:p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
              Competitive snapshot
            </p>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
            {[
              { label: 'PvP Rating', value: profile.rating ?? 1000 },
              { label: 'Battles', value: totalBattles },
              { label: 'Record', value: `${profile.wins}–${profile.losses}` },
              { label: 'Win rate', value: totalBattles > 0 ? `${winRate}%` : '—' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#17142b] px-3 py-3 text-center">
                <div className="text-lg font-black text-white">{stat.value}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-200/45">{stat.label}</div>
              </div>
            ))}
            </div>
            <dl className="mt-3 flex items-center justify-center gap-5 text-xs text-white/45">
              <div className="flex items-center gap-1.5">
                <dt>Current win streak</dt>
                <dd className="font-black text-white/80">{profile.current_streak}</dd>
              </div>
              <span className="h-3 w-px bg-white/10" aria-hidden="true" />
              <div className="flex items-center gap-1.5">
                <dt>Best</dt>
                <dd className="font-black text-white/80">{profile.best_streak}</dd>
              </div>
            </dl>
          </div>
        </section>

        {isMe && weaknesses.length > 0 && (
          <section className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-purple-300/60">Private insights</p>
                <h2 className="mt-1 text-lg font-black text-white">Where to improve</h2>
              </div>
              <Link href="/practice" className="text-xs font-bold text-purple-300 transition hover:text-white">
                Practice →
              </Link>
            </div>

            {primaryFocus && primaryInsight && (
              <div className={`mb-5 rounded-xl border p-4 ${
                primaryInsight.status === 'focus'
                  ? 'border-red-300/20 bg-red-400/[0.08]'
                  : primaryInsight.status === 'developing'
                    ? 'border-amber-300/20 bg-amber-400/[0.08]'
                    : 'border-emerald-300/20 bg-emerald-400/[0.08]'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      {primaryInsight.statusLabel}
                    </p>
                    <h3 className="mt-1 text-base font-black capitalize text-white">
                      {categoryEmoji[primaryFocus.category] ?? '📐'} {primaryFocus.category.replaceAll('_', ' ')}
                    </h3>
                  </div>
                  <span className="rounded-lg bg-black/15 px-2 py-1 text-xs font-black text-white">
                    {primaryInsight.accuracyPercent}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-5 text-white/70">{primaryInsight.observation}</p>
                <div className="mt-3 rounded-lg bg-black/15 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-200/45">Recommended next step</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-white/85">{primaryInsight.recommendation}</p>
                </div>
                <Link
                  href={`/practice?topic=${primaryFocus.category}&difficulty=easy&source=profile`}
                  onClick={() => void recordClientEvent(
                    'recommended_practice_clicked',
                    undefined,
                    { topic: primaryFocus.category, source: 'profile' }
                  )}
                  className="mt-3 block bg-white px-4 py-2.5 text-center text-sm font-black text-indigo-950 transition hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  Practise {primaryFocus.category.replaceAll('_', ' ')}
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
                  <span>{primaryFocus.total_attempts} attempts</span>
                  {primaryFocus.avg_speed_ms > 0 && <span>{(primaryFocus.avg_speed_ms / 1000).toFixed(1)}s average</span>}
                  <span>{primaryInsight.sampleLabel}</span>
                </div>
              </div>
            )}

            {weaknesses.length > 1 && (
              <details className="group border-t border-white/10 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-purple-200/55">
                    Other topic insights
                  </span>
                  <span className="flex items-center gap-2 text-xs text-white/35">
                    {weaknesses.length - 1}
                    <span className="text-base transition group-open:rotate-45" aria-hidden="true">+</span>
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
              {weaknesses.slice(1).map(w => {
                const insight = getTopicInsight(w)
                const pct   = insight.accuracyPercent
                const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                return (
                  <div key={w.category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold capitalize text-white">
                        {categoryEmoji[w.category] ?? '📐'} {w.category.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="hidden text-purple-200/45 sm:inline">{insight.sampleLabel}</span>
                        <span className={`text-xs font-bold ${
                          pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{pct}%</span>
                      </div>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-white/10"
                      role="progressbar"
                      aria-label={`${w.category.replaceAll('_', ' ')} accuracy`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                    >
                      <div className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}/>
                    </div>
                    <p className="mt-1.5 text-xs text-purple-100/45">{insight.statusLabel}</p>
                  </div>
                )
              })}
                </div>
              </details>
            )}
          </section>
        )}

        {isMe && weaknesses.length === 0 && (
          <section className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm sm:p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-400/15 text-xl">◎</div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-white">Build your performance report</h2>
              <p className="mt-0.5 text-sm text-purple-200/55">Complete a practice session to unlock topic accuracy and speed.</p>
            </div>
            <Link href="/practice" className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15">
              Practice
            </Link>
          </section>
        )}

        {isMe && (
          <details open={isAnonymous} className="group rounded-2xl border border-white/15 bg-white/[0.05] backdrop-blur-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:content-none sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-purple-300/60">Private</p>
                <h2 className="mt-1 text-lg font-black text-white">Account</h2>
                <p className="mt-1 text-xs text-white/40">Email, reminders and username settings</p>
              </div>
              <span className="text-xl text-white/35 transition group-open:rotate-45" aria-hidden="true">+</span>
            </summary>

            <div className="border-t border-white/10 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="flex justify-end py-3">
                <button onClick={() => logout()} className="text-xs font-semibold text-red-200/60 transition hover:text-red-200">
                  Sign out
                </button>
              </div>

            {isAnonymous && (
              <div className="border-y border-purple-300/20 bg-purple-400/[0.08] px-1 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white">Save this guest account</h3>
                    <p className="mt-1 text-xs leading-5 text-purple-100/55">Link Google to keep this profile, progress, coins, and rewards.</p>
                  </div>
                  <button
                    type="button"
                    onClick={linkGoogleAccount}
                    disabled={linkingGoogle}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg width="17" height="17" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    {linkingGoogle ? 'Connecting…' : 'Connect Google'}
                  </button>
                </div>
                {linkError && <p role="alert" className="mt-2 text-xs text-red-300">{linkError}</p>}
              </div>
            )}

            <dl className={`${isAnonymous ? '' : 'mt-4'} divide-y divide-white/10 border-b border-white/10 text-sm`}>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-purple-200/45">Email</dt>
                <dd className="truncate text-right font-semibold text-white/80">{email || 'Not available'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-purple-200/45">Coin balance</dt>
                <dd className="font-black text-amber-200">{(profile.points_balance ?? 0).toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-purple-200/45">Username change</dt>
                <dd className="font-semibold text-white/70">{profile.username_customized ? 'Used' : 'Available'}</dd>
              </div>
            </dl>

            {!isAnonymous && email && (
              <div className="border-b border-white/10">
                <EmailReminderPreference />
              </div>
            )}

            {!profile.username_customized && (
              <div className="mt-5">
                <h3 className="text-sm font-black text-white">Choose your permanent username</h3>
                <p className="mt-1 text-xs leading-5 text-purple-200/50">3–20 letters, numbers, or underscores. This change can only be used once.</p>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault()
                    setUsernameLoading(true)
                    setUsernameMsg(null)
                    const formData = new FormData(event.currentTarget)
                    const result = await changeUsername(formData)
                    if (result?.error) {
                      setUsernameMsg({ type: 'error', text: result.error })
                      setUsernameLoading(false)
                    }
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    name="username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={20}
                    pattern="[a-zA-Z0-9_]+"
                    value={usernameInput}
                    onChange={event => setUsernameInput(event.target.value)}
                    placeholder="New username"
                    aria-label="New username"
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/15 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-purple-400/70"
                  />
                  <button
                    type="submit"
                    disabled={usernameLoading}
                    className="rounded-xl bg-purple-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {usernameLoading ? 'Saving…' : 'Save'}
                  </button>
                </form>
                {usernameMsg && (
                  <p role="alert" className={`mt-2 text-sm ${usernameMsg.type === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                    {usernameMsg.text}
                  </p>
                )}
              </div>
            )}
            </div>
          </details>
        )}

        {/* Social login prompt for unauthenticated visitors */}
        {!isAuthenticated && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
            <p className="text-3xl mb-3">⚔️</p>
            <h2 className="text-white font-bold text-lg mb-1">Join the Battle!</h2>
            <p className="text-purple-300 text-sm mb-5">Create an account to challenge players and climb the leaderboard.</p>
            <button
              onClick={() => signInWithGoogle()}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 hover:bg-gray-100 font-semibold py-3 rounded-xl text-sm transition shadow-sm mb-3"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <div className="flex gap-2">
              <Link href="/signup"
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-2.5 rounded-xl transition text-sm text-center">
                Sign Up Free
              </Link>
              <Link href="/login"
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 rounded-xl transition text-sm text-center">
                Log In
              </Link>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Link href="/lobby"
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-center font-bold text-white transition hover:from-indigo-400 hover:to-purple-500">
            ⚔️ Play
          </Link>
          <Link href="/leaderboard"
            className="flex-1 rounded-xl bg-white/10 py-3 text-center font-bold text-white transition hover:bg-white/20">
            🏆 Rankings
          </Link>
        </div>

      </div>
    </div>
  )
}
