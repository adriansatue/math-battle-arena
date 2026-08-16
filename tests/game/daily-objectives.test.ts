import { describe, expect, it } from 'vitest'
import { objectivePercent } from '@/lib/game/daily-objectives'

describe('daily objectives', () => {
  it('caps progress display at 100 percent', () => {
    expect(objectivePercent({
      key: 'correct_15',
      target: 15,
      progress: 20,
      reward_coins: 20,
      completed: true,
      claimed: false,
    })).toBe(100)
  })

  it('handles incomplete progress', () => {
    expect(objectivePercent({
      key: 'correct_15',
      target: 15,
      progress: 6,
      reward_coins: 20,
      completed: false,
      claimed: false,
    })).toBe(40)
  })
})