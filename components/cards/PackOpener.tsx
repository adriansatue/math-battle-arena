'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { SwordLogo } from '@/components/SwordLogo'

interface Card {
  id:          string
  name:        string
  description: string
  rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
  image_url:   string
  generation?: number | null
  grade?:      number
}

interface PackOpenerProps {
  cards:   Card[]
  onClose: () => void
}

const RARITY = {
  common:    { header: 'from-gray-500 to-gray-600',     border: 'border-gray-400/50',   label: '⚪ Common',    bg: 'from-gray-900 to-gray-800',    glow: '',                     ring: '',                        flash: 'bg-white/20' },
  uncommon:  { header: 'from-green-500 to-teal-600',    border: 'border-green-400/60',  label: '🟢 Uncommon',  bg: 'from-green-950 to-gray-900',  glow: 'shadow-green-400/50',   ring: 'ring-2 ring-green-400/40', flash: 'bg-green-300/30' },
  rare:      { header: 'from-blue-500 to-indigo-600',   border: 'border-blue-400/70',   label: '🔵 Rare',      bg: 'from-blue-950 to-gray-900',   glow: 'shadow-blue-400/60',    ring: 'ring-2 ring-blue-400/50',  flash: 'bg-blue-300/35' },
  legendary: { header: 'from-yellow-400 to-orange-500', border: 'border-yellow-400/80', label: '⭐ Legendary', bg: 'from-yellow-950 to-gray-900', glow: 'shadow-yellow-400/70',  ring: 'ring-4 ring-yellow-400/70', flash: 'bg-yellow-200/45' },
}

const RARITY_ORDER: Record<string, number> = { legendary: 3, rare: 2, uncommon: 1, common: 0 }

const PARTICLES: Record<string, string[]> = {
  legendary: ['✨', '⭐', '💛', '🌟', '✨', '⭐', '💥'],
  rare:      ['✨', '💙', '🔵', '✨', '💫'],
  uncommon:  ['✨', '💚', '🌿', '✨'],
  common:    ['✨', '⚡'],
}

const GRADE_LABEL: Record<number, string> = {
  10: 'Gem Mint', 9: 'Mint', 8: 'NM-MT', 7: 'Near Mint', 6: 'EX-MT', 5: 'Excellent',
}
const GRADE_COLOR: Record<number, string> = {
  10: 'from-yellow-300 to-amber-400 text-black',
  9:  'from-emerald-400 to-teal-500 text-black',
  8:  'from-blue-400 to-indigo-500 text-white',
  7:  'from-violet-400 to-purple-500 text-white',
  6:  'from-gray-400 to-gray-500 text-white',
  5:  'from-gray-600 to-gray-700 text-white/80',
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

// ── Individual flip card ──────────────────────────────────────────────────────
function FlipCard({
  card, index, isRevealed, onReveal,
}: {
  card: Card; index: number; isRevealed: boolean; onReveal: () => void
}) {
  const [flipped,      setFlipped]      = useState(false)
  const [flashing,     setFlashing]     = useState(false)
  const [showParticle, setShowParticle] = useState(false)
  const cfg = RARITY[card.rarity]

  useEffect(() => {
    if (isRevealed && !flipped) {
      setFlipped(true)
      setFlashing(true)
      if (card.rarity !== 'common') setShowParticle(true)
      setTimeout(() => setFlashing(false), 500)
      setTimeout(() => setShowParticle(false), 1300)
    }
  }, [isRevealed, flipped, card.rarity])

  const particles = PARTICLES[card.rarity] ?? PARTICLES.common

  return (
    <div
      className="relative select-none"
      style={{ width: 160, height: card.grade !== undefined ? 260 : 224, perspective: '1000px' }}
      onClick={() => { if (!flipped) onReveal() }}
    >
      {/* Flash overlay */}
      {flashing && (
        <div
          className={`absolute inset-0 z-20 rounded-2xl pointer-events-none ${cfg.flash}`}
          style={{ animation: 'mba-flash 0.5s ease-out forwards' }}
        />
      )}

      {/* Floating particles */}
      {showParticle && particles.map((p, pi) => (
        <div
          key={pi}
          className="absolute text-base pointer-events-none z-30"
          style={{
            left:      `${15 + (pi * 25) % 70}%`,
            top:       '40%',
            animation: `mba-particle 1.2s ease-out ${pi * 90}ms forwards`,
          }}
        >{p}</div>
      ))}

      {/* 3-D flip container */}
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        transformStyle:  'preserve-3d',
        transition:      'transform 0.65s cubic-bezier(0.4,0,0.2,1)',
        transform:       flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>

        {/* ── BACK face ── */}
        <div
          style={{ backfaceVisibility: 'hidden' }}
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 border-2 border-purple-400/50 flex flex-col items-center justify-center shadow-xl cursor-pointer hover:brightness-110 transition-all"
        >
          <SwordLogo size={72} id={`pack-back-${index}`} />
          <p className="text-purple-300/60 text-xs mt-3 font-semibold tracking-wide">Tap to reveal</p>
        </div>

        {/* ── FRONT face ── */}
        <div
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          className={`absolute inset-0 rounded-2xl border-2 ${cfg.border} bg-gradient-to-b ${cfg.bg} shadow-2xl shadow-lg ${cfg.glow} ${cfg.ring} flex flex-col`}
        >
          <div className={`bg-gradient-to-r ${cfg.header} px-2 py-1.5 flex items-center justify-between flex-shrink-0`}>
            <span className="text-white text-xs font-bold">{cfg.label}</span>
            {card.generation != null && (
              <span className="bg-black/30 text-white text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded">
                {GEN_ROMAN[card.generation]}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center flex-1 p-2 bg-white/5 overflow-hidden">
            {card.image_url ? (
              <Image src={card.image_url} alt={card.name} width={112} height={112}
                className="max-h-full max-w-full object-contain drop-shadow-lg"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="text-4xl">🃏</div>
            )}
          </div>

          <div className="px-2 py-1.5 flex-shrink-0">
            <p className="text-white font-bold text-sm truncate text-center">{card.name}</p>
            <p className="text-gray-400 text-xs mt-0.5 line-clamp-2 text-center">{card.description}</p>
            <div className="flex items-center justify-center mt-1.5 gap-1">
              <span className="text-yellow-400 text-[10px]">⚡</span>
              <span className="text-yellow-300/90 text-[10px] font-bold">{cardPoints(card.rarity, card.grade).toLocaleString()} pts</span>
            </div>
          </div>

          {/* Grade badge */}
          {card.grade != null && (
            <div className={`mx-2 mb-2 rounded-lg px-2 py-1.5 flex items-center justify-between bg-gradient-to-r ${GRADE_COLOR[card.grade] ?? GRADE_COLOR[5]} flex-shrink-0`}>
              <span className="text-[10px] font-black">Grade {card.grade}</span>
              <span className="text-[10px] font-semibold opacity-90 truncate ml-1">{GRADE_LABEL[card.grade]}</span>
            </div>
          )}

          {card.rarity === 'legendary' && (
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-yellow-300/10 to-transparent animate-pulse pointer-events-none rounded-2xl" />
          )}
        </div>
      </div>

      {/* NEW sticker — outside overflow-hidden so it hangs off the corner */}
      <div className="absolute -top-3 -left-3 z-30 -rotate-12 pointer-events-none">
        <div className="relative bg-gradient-to-br from-yellow-300 to-orange-400 text-black text-xs font-black px-2 py-1 rounded-lg shadow-lg shadow-orange-500/50 leading-none tracking-wide border border-yellow-200/60">
          ✦ NEW
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <div className="absolute -left-4 top-0 h-full w-3 bg-white/40 skew-x-12 animate-[shine_2.5s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pack Opener modal ─────────────────────────────────────────────────────────
export function PackOpener({ cards, onClose }: PackOpenerProps) {
  const [revealed, setRevealed] = useState<boolean[]>(cards.map(() => false))
  const [entered,  setEntered]  = useState(false)

  const revealedCount = revealed.filter(Boolean).length
  const allRevealed   = revealedCount === cards.length

  // Best rarity among currently-revealed cards
  const bestRevealed = cards
    .filter((_, i) => revealed[i])
    .reduce(
      (best, c) => RARITY_ORDER[c.rarity] > RARITY_ORDER[best] ? c.rarity : best,
      'common' as Card['rarity']
    )

  // Staggered entrance
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60)
    return () => clearTimeout(t)
  }, [])

  function revealCard(i: number) {
    setRevealed(prev => prev.map((v, idx) => idx === i ? true : v))
  }

  function revealAll() {
    cards.forEach((_, i) => setTimeout(() => revealCard(i), i * 175))
  }

  const overlayBg = {
    legendary: 'from-yellow-950/90 via-gray-950/90 to-orange-950/90',
    rare:      'from-blue-950/90 via-gray-950/90 to-indigo-950/90',
    uncommon:  'from-teal-950/90 via-gray-950/90 to-green-950/90',
    common:    'from-gray-950/90 via-black/90 to-gray-950/90',
  }[allRevealed ? bestRevealed : 'common']

  const titleText = !allRevealed  ? '🎁 Pack Opened!'
    : bestRevealed === 'legendary' ? '🌟 LEGENDARY PULL!'
    : bestRevealed === 'rare'      ? '✨ Rare Find!'
    : bestRevealed === 'uncommon'  ? '🎉 Uncommon Cards!'
    : '🎁 Pack Opened!'

  return (
    <>
      <style>{`
        @keyframes mba-flash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes mba-particle {
          0%   { transform: translateY(0)     scale(1);    opacity: 1; }
          100% { transform: translateY(-90px) scale(0.4);  opacity: 0; }
        }
      `}</style>

      <div
        className={`fixed inset-0 bg-gradient-to-br ${overlayBg} backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-700`}
      >
        <div className="w-full max-w-lg">

          {/* Title */}
          <div
            className="text-center mb-8 transition-all duration-500"
            style={{ opacity: entered ? 1 : 0, transform: entered ? 'none' : 'translateY(-16px)' }}
          >
            <h2 className="text-4xl font-black text-white tracking-tight mb-1">{titleText}</h2>
            <p className="text-purple-300/80 text-sm">
              {allRevealed
                ? 'Cards added to your collection!'
                : `${revealedCount} / ${cards.length} revealed — tap a card!`}
            </p>
          </div>

          {/* Cards row */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {cards.map((card, i) => (
              <div
                key={`${card.id}-${i}`}
                style={{
                  transitionProperty: 'opacity, transform',
                  transitionDuration: '500ms',
                  transitionDelay:    `${i * 100}ms`,
                  opacity:   entered ? 1 : 0,
                  transform: entered ? 'none' : 'translateY(28px) scale(0.92)',
                }}
              >
                <FlipCard
                  card={card}
                  index={i}
                  isRevealed={revealed[i]}
                  onReveal={() => revealCard(i)}
                />
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div
            className="flex gap-3"
            style={{ opacity: entered ? 1 : 0, transition: 'opacity 0.5s 0.4s' }}
          >
            {!allRevealed ? (
              <button
                onClick={revealAll}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition border border-white/10"
              >
                Reveal All ⚡
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black py-3 rounded-xl transition-all hover:scale-105 text-lg shadow-lg shadow-purple-900/40"
              >
                Add to Collection ✨
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  )
}