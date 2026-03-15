'use client'

import Image from 'next/image'

interface RewardCardProps {
  name:          string
  description:   string
  rarity:        'common' | 'uncommon' | 'rare' | 'legendary'
  image_url:     string
  grade?:        number
  generation?:   number
  obtained_via?: string
  isNew?:        boolean
  flipped?:      boolean
  onClick?:      () => void
}

const RARITY_BASE: Record<string, number> = { common: 50, uncommon: 150, rare: 500, legendary: 2000 }
const GRADE_MULT:  Record<number, number>  = { 10: 2.0, 9: 1.75, 8: 1.5, 7: 1.25, 6: 1.1, 5: 1.0 }
function cardPoints(rarity: string, grade?: number) {
  const base = RARITY_BASE[rarity] ?? 50
  const mult = grade ? (GRADE_MULT[grade] ?? 1.0) : 1.0
  return Math.round(base * mult)
}

const GEN_ROMAN: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX',
}

const GRADE_LABEL: Record<number, string> = {
  10: 'Gem Mint',
  9:  'Mint',
  8:  'NM-MT',
  7:  'Near Mint',
  6:  'EX-MT',
  5:  'Excellent',
}

const GRADE_GRADIENT: Record<number, string> = {
  10: 'from-yellow-300 via-amber-400 to-yellow-300 text-black',
  9:  'from-emerald-400 via-teal-400 to-emerald-400 text-black',
  8:  'from-blue-400 via-indigo-400 to-blue-400 text-white',
  7:  'from-violet-400 via-purple-400 to-violet-400 text-white',
  6:  'from-gray-400 via-gray-500 to-gray-400 text-white',
  5:  'from-gray-600 via-gray-700 to-gray-600 text-white/80',
}

const rarityConfig = {
  common: {
    header:  'from-gray-500 to-gray-600',
    border:  'border-gray-400/50',
    imgBg:   'from-gray-800 to-gray-900',
    glowBg:  'bg-gray-400',
    shadow:  '',
    label:   'Common',
    dot:     'bg-gray-300',
  },
  uncommon: {
    header:  'from-green-500 to-teal-600',
    border:  'border-green-400/60',
    imgBg:   'from-green-950 to-gray-900',
    glowBg:  'bg-green-400',
    shadow:  'shadow-green-500/40',
    label:   'Uncommon',
    dot:     'bg-green-400',
  },
  rare: {
    header:  'from-blue-500 to-indigo-600',
    border:  'border-blue-400/70',
    imgBg:   'from-blue-950 to-indigo-950',
    glowBg:  'bg-blue-400',
    shadow:  'shadow-blue-500/50',
    label:   'Rare',
    dot:     'bg-blue-400',
  },
  legendary: {
    header:  'from-yellow-400 to-orange-500',
    border:  'border-yellow-400/80',
    imgBg:   'from-yellow-950 to-orange-950',
    glowBg:  'bg-yellow-400',
    shadow:  'shadow-yellow-500/60',
    label:   'Legendary',
    dot:     'bg-yellow-400',
  },
}

export function RewardCard({
  name, description, rarity, image_url, grade, generation, isNew, flipped, onClick
}: RewardCardProps) {
  const cfg = rarityConfig[rarity] ?? rarityConfig.common
  const pts = cardPoints(rarity, grade)

  if (flipped) {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer w-36 h-52 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 border-2 border-purple-400/50 flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
      >
        <div className="text-5xl">⚔️</div>
      </div>
    )
  }

  return (
    <div className={`relative w-36 ${onClick ? 'cursor-pointer hover:scale-105 transition-transform duration-200' : ''}`}>
      {/* NEW badge — outside the overflow-hidden card so it's never clipped */}
      {isNew && (
        <div className="absolute -top-3 -left-3 z-20 -rotate-12">
          <div className="relative bg-gradient-to-br from-yellow-300 to-orange-400 text-black text-xs font-black px-2 py-1 rounded-lg shadow-lg shadow-orange-500/50 leading-none tracking-wide border border-yellow-200/60">
            ✦ NEW
            <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
              <div className="absolute -left-4 top-0 h-full w-3 bg-white/40 skew-x-12 animate-[shine_2.5s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}

      {/* Inner card — overflow-hidden stays here for rounded corners */}
      <div
        onClick={onClick}
        className={`relative rounded-2xl border-2 ${cfg.border} overflow-hidden shadow-xl ${cfg.shadow ? `shadow-lg ${cfg.shadow}` : ''} ${isNew ? 'ring-2 ring-white/60' : ''}`}
        style={{ background: 'linear-gradient(160deg, #1c1040 0%, #0e0825 100%)' }}
      >
      {/* Rarity strip */}
      <div className={`bg-gradient-to-r ${cfg.header} px-2.5 py-1 flex items-center justify-between`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0 shadow-sm`} />
          <span className="text-white text-xs font-bold tracking-wide uppercase">{cfg.label}</span>
        </div>
        {generation != null && (
          <span className="bg-black/30 text-white text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded">
            {GEN_ROMAN[generation]}
          </span>
        )}
      </div>

      {/* Image area */}
      <div className={`relative h-28 bg-gradient-to-b ${cfg.imgBg} flex items-center justify-center p-2`}>
        {/* Radial glow behind artwork */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
          <div className={`w-20 h-20 rounded-full ${cfg.glowBg} opacity-10 blur-2xl`} />
        </div>
        {image_url ? (
          <Image
            src={image_url}
            alt={name}
            width={108}
            height={108}
            className="relative z-10 max-h-full max-w-full object-contain drop-shadow-xl"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="text-4xl">🃏</div>
        )}
      </div>

      {/* Divider */}
      <div className={`h-px bg-gradient-to-r ${cfg.header} opacity-40`} />

      {/* Card info */}
      <div className="px-2.5 pt-2 pb-1.5">
        <p className="text-white font-bold text-sm leading-tight truncate text-center">{name}</p>
        <p className="text-gray-400/80 text-xs mt-0.5 line-clamp-2 leading-snug text-center">{description}</p>
        <div className="flex items-center justify-center mt-1.5 gap-1">
          <span className="text-yellow-400 text-[10px]">⚡</span>
          <span className="text-yellow-300/90 text-[10px] font-bold">{pts.toLocaleString()} pts</span>
        </div>
      </div>

      {/* Grade slab footer */}
      {grade != null && (
        <div className="mx-2 mb-2 rounded-lg overflow-hidden">
          <div className={`bg-gradient-to-r ${GRADE_GRADIENT[grade] ?? GRADE_GRADIENT[5]} flex items-center justify-between px-2 py-1.5`}>
            <span className="text-[10px] font-black tracking-wide">Grade {grade}</span>
            <span className="text-[10px] font-semibold opacity-90 truncate ml-1">{GRADE_LABEL[grade]}</span>
          </div>
        </div>
      )}

      {/* Legendary shimmer */}
      {rarity === 'legendary' && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-yellow-300/8 to-transparent animate-pulse pointer-events-none" />
      )}

      {/* Rare holographic sheen */}
      {rarity === 'rare' && (
        <div className="absolute inset-0 bg-gradient-to-bl from-blue-300/5 via-transparent to-indigo-300/5 pointer-events-none" />
      )}
      </div>{/* end inner card */}
    </div>
  )
}