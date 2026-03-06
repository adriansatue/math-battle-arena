'use client'

import Image from 'next/image'

interface RewardCardProps {
  name:        string
  description: string
  rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
  image_url:   string
  obtained_via?: string
  isNew?:      boolean
  flipped?:    boolean
  onClick?:    () => void
}

const rarityConfig = {
  common:    { color: 'from-gray-500 to-gray-600',     border: 'border-gray-400/50',    label: '⚪ Common',    glow: '' },
  uncommon:  { color: 'from-green-500 to-teal-600',    border: 'border-green-400/50',   label: '🟢 Uncommon',  glow: 'shadow-green-500/30' },
  rare:      { color: 'from-blue-500 to-indigo-600',   border: 'border-blue-400/50',    label: '🔵 Rare',      glow: 'shadow-blue-500/40' },
  legendary: { color: 'from-yellow-400 to-orange-500', border: 'border-yellow-400/60',  label: '⭐ Legendary', glow: 'shadow-yellow-500/50' },
}

export function RewardCard({
  name, description, rarity, image_url, isNew, flipped, onClick
}: RewardCardProps) {
  const cfg = rarityConfig[rarity] ?? rarityConfig.common

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
    <div
      onClick={onClick}
      className={`relative w-36 h-52 rounded-2xl border-2 ${cfg.border} bg-gradient-to-b from-gray-900 to-gray-800 overflow-hidden shadow-xl ${cfg.glow ? `shadow-lg ${cfg.glow}` : ''} ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''} ${isNew ? 'ring-2 ring-white/50 animate-pulse' : ''}`}
    >
      {/* Rarity header */}
      <div className={`bg-gradient-to-r ${cfg.color} px-2 py-1 text-center`}>
        <span className="text-white text-xs font-bold">{cfg.label}</span>
      </div>

      {/* Card image */}
      <div className="flex items-center justify-center h-28 p-2 bg-white/5 relative">
        {image_url ? (
          <Image
            src={image_url}
            alt={name}
            width={112}
            height={112}
            className="max-h-full max-w-full object-contain drop-shadow-lg"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="text-4xl">🃏</div>
        )}
      </div>

      {/* Card info */}
      <div className="p-2 text-center">
        <p className="text-white font-bold text-sm truncate">{name}</p>
        <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{description}</p>
      </div>

      {/* New badge */}
      {isNew && (
        <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
          NEW
        </div>
      )}

      {/* Legendary shimmer */}
      {rarity === 'legendary' && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-yellow-400/10 to-transparent animate-pulse pointer-events-none" />
      )}
    </div>
  )
}