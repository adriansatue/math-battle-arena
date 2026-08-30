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

const CHAPTERS = ['Training Grounds', 'Number League', 'Logic Circuit', 'Masters Arena']

export function BotCampaignPanel({ progress, selectedLevel, starting, error, onSelect, onStart }: Props) {
  const selected = getBotLevelConfig(selectedLevel)
  const unlocked = progress?.highest_unlocked ?? 1
  const defeated = progress?.highest_defeated ?? 0
  const completion = Math.round((defeated / BOT_LEVELS.length) * 100)

  return (
    <section id="bot-campaign" className="border border-amber-300/25 bg-[#17130d] p-4 shadow-xl shadow-black/20 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-amber-300/70">Solo campaign</p>
          <h2 className="mt-1 text-xl font-black text-white">Climb the Bot Arena</h2>
          <p className="mt-1 text-sm text-white/55">Defeat each rival to unlock the next. First wins award bonus coins.</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-2xl font-black text-amber-300">{defeated}/20</p>
          <p className="text-xs text-white/40">levels cleared · {progress?.total_wins ?? 0} wins</p>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden bg-white/10" aria-label={`${completion}% campaign complete`}>
        <div className="h-full bg-amber-300 transition-all" style={{ width: `${completion}%` }} />
      </div>

      {error ? (
        <p role="alert" className="mt-4 border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</p>
      ) : (
        <div className="mt-5 space-y-5">
          {CHAPTERS.map(chapter => {
            const levels = BOT_LEVELS.filter(level => level.chapter === chapter)
            return (
              <div key={chapter}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-white/50">{chapter}</h3>
                  <span className="text-[11px] text-white/30">Levels {levels[0].level}-{levels.at(-1)?.level}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
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
                        className={`relative aspect-square min-w-0 border text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-amber-200 ${
                          isSelected
                            ? 'border-amber-200 bg-amber-300 text-black'
                            : isCleared
                              ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'
                              : isLocked
                                ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-white/20'
                                : 'border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20'
                        }`}
                      >
                        {level.level}
                        {isCleared && <span aria-hidden="true" className="absolute right-1 top-0.5 text-[9px]">✓</span>}
                        {isLocked && <span aria-hidden="true" className="absolute right-1 top-0.5 text-[8px]">■</span>}
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
        <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-amber-300 px-2 py-1 text-xs font-black text-black">LEVEL {selected.level}</span>
              <h3 className="font-black text-white">{selected.name}</h3>
              <span className="text-xs capitalize text-white/40">{selected.difficulty}</span>
            </div>
            <p className="mt-2 text-sm text-white/55">
              About {Math.round(selected.accuracy * 100)}% accurate · {Math.round(selected.minSpeedMs / 100) / 10}-{Math.round(selected.maxSpeedMs / 100) / 10}s responses
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-200/75">First-clear reward: +{selected.firstWinCoins} coins</p>
          </div>
          <button
            type="button"
            onClick={() => onStart(selected.level)}
            disabled={starting || selected.level > unlocked}
            className="min-h-12 bg-amber-300 px-6 py-3 text-sm font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? 'Preparing rival...' : selected.level <= defeated ? 'Battle again' : `Challenge ${selected.name}`}
          </button>
        </div>
      )}
    </section>
  )
}
