import { describe, expect, it } from 'vitest'
import { calculateBattleRewards, calculatePoints, calculateRatingDelta, isFlagged } from '@/lib/game/scoring'

describe('calculatePoints', () => {
  it('awards base, speed, first-answer, and streak bonuses for a perfect realtime answer', () => {
    expect(calculatePoints({
      difficulty:    'easy',
      isCorrect:     true,
      timeTakenMs:   0,
      timeLimitSecs: 10,
      isFirstAnswer: true,
      currentStreak: 3,
    })).toBe(125)
  })

  it('awards zero points for wrong answers', () => {
    expect(calculatePoints({
      difficulty:    'hard',
      isCorrect:     false,
      timeTakenMs:   100,
      timeLimitSecs: 10,
      isFirstAnswer: true,
      currentStreak: 9,
    })).toBe(0)
  })

  it('does not award a negative speed bonus for late answers', () => {
    expect(calculatePoints({
      difficulty:    'medium',
      isCorrect:     true,
      timeTakenMs:   99_000,
      timeLimitSecs: 10,
      isFirstAnswer: false,
      currentStreak: 0,
    })).toBe(120)
  })

  it('applies progressive streak tiers based on the next correct answer', () => {
    expect(calculatePoints({
      difficulty:    'medium',
      isCorrect:     true,
      timeTakenMs:   15_000,
      timeLimitSecs: 15,
      isFirstAnswer: false,
      currentStreak: 4,
    })).toBe(140)
  })
})

describe('calculateBattleRewards', () => {
  it('keeps practice useful but limits spendable coins', () => {
    expect(calculateBattleRewards({
      mode:     'practice',
      answerXp: 400,
      isWinner: false,
      isDraw:   false,
    })).toMatchObject({
      xpEarned:    400,
      coinsEarned: 100,
      ratingDelta: 0,
    })
  })

  it('gives PvP the full economy rate and winner XP bonus', () => {
    expect(calculateBattleRewards({
      mode:           'pvp',
      answerXp:       400,
      isWinner:       true,
      isDraw:         false,
      ownRating:      1000,
      opponentRating: 1000,
    })).toMatchObject({
      xpEarned:    550,
      coinsEarned: 550,
      ratingDelta: 16,
    })
  })
})

describe('calculateRatingDelta', () => {
  it('does not change rating outside PvP', () => {
    expect(calculateRatingDelta({
      mode:     'bot',
      answerXp: 300,
      isWinner: true,
      isDraw:   false,
    })).toBe(0)
  })
})

describe('isFlagged', () => {
  it('does not flag fast but plausible answers', () => {
    expect(isFlagged(120, 120, 10)).toBe(false)
  })

  it('flags implausibly instant timings', () => {
    expect(isFlagged(50, 50, 10)).toBe(true)
  })

  it('flags clients claiming to be much faster than the server observed', () => {
    expect(isFlagged(500, 6_000, 10)).toBe(true)
  })

  it('does not flag normal timings', () => {
    expect(isFlagged(2_000, 2_200, 10)).toBe(false)
  })
})
