export type BotDifficulty = 'easy' | 'medium' | 'hard'

interface BotConfig {
  accuracy:      number  // 0-1 probability of correct answer
  minSpeedMs:    number  // fastest possible response
  maxSpeedMs:    number  // slowest possible response
  streakBonus:   boolean // does bot get streaks?
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