'use client'

import { useState } from 'react'
import { RewardCard } from './RewardCard'

interface Card {
  id:          string
  name:        string
  description: string
  rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
  image_url:   string
}

interface PackOpenerProps {
  cards:     Card[]
  onClose:   () => void
}

export function PackOpener({ cards, onClose }: PackOpenerProps) {
  const [revealed,    setRevealed]    = useState<boolean[]>(cards.map(() => false))
  const [allRevealed, setAllRevealed] = useState(false)

  function revealCard(i: number) {
    const next = [...revealed]
    next[i] = true
    setRevealed(next)
    if (next.every(Boolean)) setAllRevealed(true)
  }

  function revealAll() {
    setRevealed(cards.map(() => true))
    setAllRevealed(true)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg">

        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-1">🎁 Pack Opened!</h2>
          <p className="text-purple-300 text-sm">
            {allRevealed
              ? 'Cards added to your collection!'
              : 'Tap each card to reveal it!'}
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {cards.map((card, i) => (
            <div
              key={card.id}
              className={`transition-all duration-500 ${revealed[i] ? 'scale-100 opacity-100' : 'scale-95 opacity-90'}`}
            >
              {revealed[i] ? (
                <RewardCard
                  name={card.name}
                  description={card.description}
                  rarity={card.rarity}
                  image_url={card.image_url}
                  isNew={true}
                />
              ) : (
                <RewardCard
                  name=""
                  description=""
                  rarity="common"
                  image_url=""
                  flipped={true}
                  onClick={() => revealCard(i)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {!allRevealed && (
            <button
              onClick={revealAll}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition"
            >
              Reveal All
            </button>
          )}
          {allRevealed && (
            <button
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 rounded-xl transition"
            >
              Add to Collection ✨
            </button>
          )}
        </div>

      </div>
    </div>
  )
}