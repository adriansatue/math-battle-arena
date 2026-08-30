import { describe, expect, it } from 'vitest'
import {
  BOT_LEVELS,
  getBotLevelConfig,
  isBotCampaignLevel,
} from '@/lib/game/bot'

describe('bot campaign', () => {
  it('defines exactly 20 ordered levels', () => {
    expect(BOT_LEVELS).toHaveLength(20)
    expect(BOT_LEVELS.map(level => level.level)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    )
    expect(getBotLevelConfig(1)).toBe(BOT_LEVELS[0])
    expect(getBotLevelConfig(20)).toBe(BOT_LEVELS[19])
  })

  it('increases accuracy and rewards while reducing response times', () => {
    for (let index = 1; index < BOT_LEVELS.length; index += 1) {
      const previous = BOT_LEVELS[index - 1]
      const current = BOT_LEVELS[index]

      expect(current.accuracy).toBeGreaterThan(previous.accuracy)
      expect(current.firstWinCoins).toBeGreaterThan(previous.firstWinCoins)
      expect(current.minSpeedMs).toBeLessThan(previous.minSpeedMs)
      expect(current.maxSpeedMs).toBeLessThan(previous.maxSpeedMs)
    }
  })

  it('accepts only integer campaign levels from 1 through 20', () => {
    expect(isBotCampaignLevel(1)).toBe(true)
    expect(isBotCampaignLevel(20)).toBe(true)
    expect(isBotCampaignLevel(0)).toBe(false)
    expect(isBotCampaignLevel(21)).toBe(false)
    expect(isBotCampaignLevel(1.5)).toBe(false)
    expect(isBotCampaignLevel('1')).toBe(false)
    expect(isBotCampaignLevel(null)).toBe(false)
  })
})
