export type BotDifficulty = 'easy' | 'medium' | 'hard'
export type BotCampaignLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20

export interface BotConfig {
  accuracy:      number  // 0-1 probability of correct answer
  minSpeedMs:    number  // fastest possible response
  maxSpeedMs:    number  // slowest possible response
  streakBonus:   boolean // does bot get streaks?
}

export interface BotLevelConfig extends BotConfig {
  level: BotCampaignLevel
  name: string
  chapter: string
  difficulty: BotDifficulty
  firstWinCoins: number
}

export const BOT_CONFIGS: Record<BotDifficulty, BotConfig> = {
  easy:   { accuracy: 0.60, minSpeedMs: 8000, maxSpeedMs: 14000, streakBonus: false },
  medium: { accuracy: 0.75, minSpeedMs: 5000, maxSpeedMs: 10000, streakBonus: false },
  hard:   { accuracy: 0.90, minSpeedMs: 2000, maxSpeedMs:  7000, streakBonus: true  },
}

export function getBotAnswer(
  correctAnswer: number,
  difficulty:    BotDifficulty
): { answer: number; isCorrect: boolean } {
  const config    = BOT_CONFIGS[difficulty]
  const isCorrect = Math.random() < config.accuracy

  if (isCorrect) {
    return { answer: correctAnswer, isCorrect: true }
  }

  // Wrong answer — plausible mistake near the correct answer
  const mistake = correctAnswer + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 5 + 1)
  return { answer: mistake, isCorrect: false }
}

export function getBotDelay(difficulty: BotDifficulty): number {
  const { minSpeedMs, maxSpeedMs } = BOT_CONFIGS[difficulty]
  return Math.floor(Math.random() * (maxSpeedMs - minSpeedMs) + minSpeedMs)
}

const BOT_NAMES = [
  'Rookie Ray', 'Quick Quinn', 'Sum Scout', 'Number Ninja', 'Captain Carry',
  'Product Pilot', 'Division Dash', 'Fraction Fox', 'Bracket Breaker', 'Algebra Ace',
  'Rapid Root', 'Prime Hunter', 'Equation Echo', 'Logic Lance', 'Vector Viper',
  'Quantum Quinn', 'Cipher Storm', 'Omega Solver', 'Arena Titan', 'Math Master',
] as const

export const BOT_LEVELS: BotLevelConfig[] = BOT_NAMES.map((name, index) => {
  const level = (index + 1) as BotCampaignLevel
  const difficulty: BotDifficulty = level <= 6 ? 'easy' : level <= 14 ? 'medium' : 'hard'
  const chapter = level <= 5 ? 'Training Grounds'
    : level <= 10 ? 'Number League'
      : level <= 15 ? 'Logic Circuit'
        : 'Masters Arena'

  return {
    level,
    name,
    chapter,
    difficulty,
    accuracy: Math.min(0.96, 0.48 + level * 0.024),
    minSpeedMs: Math.max(900, 9_500 - level * 390),
    maxSpeedMs: Math.max(2_800, 15_000 - level * 560),
    streakBonus: level >= 11,
    firstWinCoins: 15 + level * 5,
  }
})

export function isBotCampaignLevel(value: unknown): value is BotCampaignLevel {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= BOT_LEVELS.length
}

export function getBotLevelConfig(level: BotCampaignLevel): BotLevelConfig {
  return BOT_LEVELS[level - 1]
}

export function getCampaignBotAnswer(correctAnswer: number, level: BotCampaignLevel) {
  const config = getBotLevelConfig(level)
  const isCorrect = Math.random() < config.accuracy
  if (isCorrect) return { answer: correctAnswer, isCorrect: true }

  const mistakeRange = level >= 15 ? 2 : level >= 8 ? 4 : 6
  const mistake = correctAnswer + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * mistakeRange + 1)
  return { answer: mistake, isCorrect: false }
}

export function getCampaignBotDelay(level: BotCampaignLevel): number {
  const { minSpeedMs, maxSpeedMs } = getBotLevelConfig(level)
  return Math.floor(Math.random() * (maxSpeedMs - minSpeedMs) + minSpeedMs)
}