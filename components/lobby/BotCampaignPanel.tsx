'use client'

import { BOT_LEVELS, getBotLevelConfig } from '@/lib/game/bot'
import type { BotCampaignLevel } from '@/lib/game/bot'

type CampaignProgress = {
  highest_unlocked: number
  highest_defeated: number
  total_wins: number
}

type Props = {
  progress: CampaignProgress | null
  selectedLevel: BotCampaignLevel
  starting: boolean
  error: string | null
  onSelect: (level: BotCampaignLevel) => void
  onStart: (level: BotCampaignLevel) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  fractions: 'Fractions',
  order_of_ops: 'Order of operations',
}

export function BotCampaignPanel({ progress, selectedLevel, starting, error, onSelect, onStart }: Props) {
  const selected = getBotLevelConfig(selectedLevel)
  const unlocked = progress?.highest_unlocked ?? 1
  const defeated = progress?.highest_defeated ?? 0
  const completion = Math.round((defeated / BOT_LEVELS.length) * 100)
  const chapters = Array.from(new Set(BOT_LEVELS.map(level => level.chapter)))

  return (
    <section className="rounded-2xl border border-purple-300/20 bg-white/10 p-4 shadow-xl shadow-purple-950/25 backdrop-blur-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Campaign map</p>
          <h2 className="mt-1 text-xl font-black text-white">Climb the Bot Arena</h2>
          <p className="mt-1 text-sm text-purple-100/65">Defeat each rival to unlock the next. First wins award bonus coins.</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-2xl font-black text-amber-300">{defeated}/{BOT_LEVELS.length}</p>
          <p className="text-xs text-purple-100/45">levels cleared · {progress?.total_wins ?? 0} wins</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-label="Campaign completion" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 transition-all" style={{ width: `${completion}%` }} />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</p>
      ) : (
        <div className="mt-5 space-y-5">
          {chapters.map(chapter => {
            const levels = BOT_LEVELS.filter(level => level.chapter === chapter)
            return (
              <div key={chapter} className="rounded-2xl border border-white/10 bg-black/10 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wide text-purple-200">{chapter}</h3>
                  <span className="text-[11px] text-purple-100/40">Levels {levels[0].level}-{levels.at(-1)?.level}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {levels.map(level => {
                    const isLocked = level.level > unlocked
                    const isCleared = level.level <= defeated
                    const isSelected = selectedLevel === level.level
                    return (
                      <button
                        key={level.level}
                        type="button"
                        onClick={() => onSelect(level.level)}
                        disabled={isLocked || starting}
                        aria-label={`Level ${level.level}: ${level.name}${isLocked ? ', locked' : isCleared ? ', cleared' : ''}`}
                        aria-pressed={isSelected}
                        className={`relative min-h-20 min-w-0 rounded-xl border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-200 sm:aspect-square sm:min-h-0 ${
                          isSelected
                            ? 'border-amber-200 bg-amber-300 text-slate-950 shadow-lg shadow-purple-950/25'
                            : isCleared
                              ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'
                              : isLocked
                                ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-purple-100/25'
                                : 'border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20'
                        }`}
                      >
                        <span className="block text-lg font-black">{level.level}</span>
                        <span className="mt-1 block truncate text-[11px] font-bold leading-tight opacity-80">{level.name}</span>
                        <span className="mt-1 block truncate text-[9px] font-semibold uppercase opacity-55">{CATEGORY_LABELS[level.category]}</span>
                        {isCleared && <span aria-hidden="true" className="absolute right-2 top-2 text-[10px]">✓</span>}
                        {isLocked && <span aria-hidden="true" className="absolute right-2 top-2 text-[9px]">■</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!error && (
        <div className="mt-5 grid gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-amber-300 px-2 py-1 text-xs font-black text-slate-950">LEVEL {selected.level}</span>
              <h3 className="font-black text-white">{selected.name}</h3>
              <span className="text-xs text-white/45">{selected.title}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-amber-100">Learn: {selected.lesson}</p>
            <p className="mt-1 text-sm text-purple-100/70">Mission: {selected.mission}</p>
            <p className="mt-2 text-sm text-purple-100/65">
              {CATEGORY_LABELS[selected.category]} · {selected.difficulty} · about {Math.round(selected.accuracy * 100)}% rival accuracy · {Math.round(selected.minSpeedMs / 100) / 10}-{Math.round(selected.maxSpeedMs / 100) / 10}s responses
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-200/75">First-clear reward: +{selected.firstWinCoins} coins</p>
          </div>
          <button
            type="button"
            onClick={() => onStart(selected.level)}
            disabled={starting || selected.level > unlocked}
            className="min-h-12 rounded-xl bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-purple-950/25 transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? 'Preparing rival...' : selected.level <= defeated ? 'Battle again' : `Challenge ${selected.name}`}
          </button>
        </div>
      )}
    </section>
  )
}
