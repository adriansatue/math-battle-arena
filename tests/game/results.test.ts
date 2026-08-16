import { describe, expect, it } from 'vitest'
import { getResultRecommendation } from '@/lib/game/results'

describe('result recommendation', () => {
  it('selects the lowest-accuracy topic without inventing a misconception', () => {
    expect(getResultRecommendation([
      { category: 'addition', isCorrect: true },
      { category: 'addition', isCorrect: true },
      { category: 'division', isCorrect: false },
      { category: 'division', isCorrect: true },
    ])).toEqual({
      topic: 'division',
      correct: 1,
      total: 2,
      kind: 'focus',
    })
  })

  it('turns a perfect result into a positive challenge', () => {
    expect(getResultRecommendation([
      { category: 'multiplication', isCorrect: true },
      { category: 'multiplication', isCorrect: true },
    ])).toEqual({
      topic: 'multiplication',
      correct: 2,
      total: 2,
      kind: 'challenge',
    })
  })

  it('returns no recommendation without measured answers', () => {
    expect(getResultRecommendation([])).toBeNull()
  })
})