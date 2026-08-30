import { describe, expect, it } from 'vitest'
import {
  BOT_LEVELS,
  getBotLevelConfig,
  isBotCampaignLevel,
} from '@/lib/game/bot'

describe('bot campaign', () => {
  it('defines at least 20 contiguous levels and can grow by appending rivals', () => {
    expect(BOT_LEVELS.length).toBeGreaterThanOrEqual(20)
    expect(BOT_LEVELS.map(level => level.level)).toEqual(
      Array.from({ length: BOT_LEVELS.length }, (_, index) => index + 1),
    )
    expect(getBotLevelConfig(1)).toBe(BOT_LEVELS[0])
    expect(getBotLevelConfig(BOT_LEVELS.length)).toBe(BOT_LEVELS.at(-1))
  })

  it('gives every rival a unique identity, lesson, mission, and math focus', () => {
    expect(new Set(BOT_LEVELS.map(level => level.name)).size).toBe(BOT_LEVELS.length)
    for (const level of BOT_LEVELS) {
      expect(level.name.length).toBeGreaterThan(0)
      expect(level.title.length).toBeGreaterThan(0)
      expect(level.chapter.length).toBeGreaterThan(0)
      expect(level.lesson.length).toBeGreaterThan(0)
      expect(level.mission.length).toBeGreaterThan(0)
      expect(['addition', 'subtraction', 'multiplication', 'division', 'fractions', 'order_of_ops']).toContain(level.category)
    }
  })

  it('does not reduce accuracy or rewards as response times become faster', () => {
    for (let index = 1; index < BOT_LEVELS.length; index += 1) {
      const previous = BOT_LEVELS[index - 1]
      const current = BOT_LEVELS[index]

      expect(current.accuracy).toBeGreaterThanOrEqual(previous.accuracy)
      expect(current.firstWinCoins).toBeGreaterThan(previous.firstWinCoins)
      expect(current.minSpeedMs).toBeLessThanOrEqual(previous.minSpeedMs)
      expect(current.maxSpeedMs).toBeLessThanOrEqual(previous.maxSpeedMs)
    }
  })

  it('accepts only integer levels present in the current catalog', () => {
    expect(isBotCampaignLevel(1)).toBe(true)
    expect(isBotCampaignLevel(BOT_LEVELS.length)).toBe(true)
    expect(isBotCampaignLevel(0)).toBe(false)
    expect(isBotCampaignLevel(BOT_LEVELS.length + 1)).toBe(false)
    expect(isBotCampaignLevel(1.5)).toBe(false)
    expect(isBotCampaignLevel('1')).toBe(false)
    expect(isBotCampaignLevel(null)).toBe(false)
  })
})
