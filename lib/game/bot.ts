import type { Category } from './questions'

export type BotDifficulty = 'easy' | 'medium' | 'hard'
export type BotCampaignLevel = number

export interface BotConfig {
  accuracy:      number  // 0-1 probability of correct answer
  minSpeedMs:    number  // fastest possible response
  maxSpeedMs:    number  // slowest possible response
  streakBonus:   boolean // does bot get streaks?
}

export interface BotLevelConfig extends BotConfig {
  level: BotCampaignLevel
  name: string
  title: string
  chapter: string
  category: Category
  lesson: string
  mission: string
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

type RivalIdentity = Pick<BotLevelConfig, 'name' | 'title' | 'chapter' | 'category' | 'lesson' | 'mission'>

const RIVALS: RivalIdentity[] = [
  { name: 'Rookie Ray', title: 'The Warm-Up', chapter: 'Training Grounds', category: 'addition', lesson: 'Build confidence adding positive numbers.', mission: 'Defeat Ray in an addition-only duel.' },
  { name: 'Mina Minus', title: 'The Balancer', chapter: 'Training Grounds', category: 'subtraction', lesson: 'Read subtraction carefully and track the difference.', mission: 'Win a duel built around subtraction.' },
  { name: 'Times Tina', title: 'The Pattern Spotter', chapter: 'Training Grounds', category: 'multiplication', lesson: 'Use number patterns to multiply with less hesitation.', mission: 'Beat Tina across the multiplication tables.' },
  { name: 'Division Dash', title: 'The Equal Splitter', chapter: 'Training Grounds', category: 'division', lesson: 'Reverse multiplication to divide exactly.', mission: 'Solve Dash’s exact-division challenge.' },
  { name: 'Captain Carry', title: 'The Gatekeeper', chapter: 'Training Grounds', category: 'addition', lesson: 'Combine larger totals without losing place value.', mission: 'Clear the Training Grounds with accurate sums.' },
  { name: 'Product Pilot', title: 'The Table Navigator', chapter: 'Number League', category: 'multiplication', lesson: 'Recall products quickly under a shorter timer.', mission: 'Outscore Pilot in a multiplication race.' },
  { name: 'Remainder Rex', title: 'The Divider', chapter: 'Number League', category: 'division', lesson: 'Recognise factor pairs and quotients at speed.', mission: 'Break Rex’s division defence.' },
  { name: 'Fraction Fox', title: 'The Piece Keeper', chapter: 'Number League', category: 'fractions', lesson: 'Combine fractions and express the result as a number.', mission: 'Defeat Fox using fraction arithmetic.' },
  { name: 'Bracket Breaker', title: 'The Rule Enforcer', chapter: 'Number League', category: 'order_of_ops', lesson: 'Apply brackets and multiplication before addition.', mission: 'Break every order-of-operations trap.' },
  { name: 'Negative Nova', title: 'The Sign Shifter', chapter: 'Number League', category: 'subtraction', lesson: 'Stay accurate when subtraction produces negative answers.', mission: 'Win while mastering signed differences.' },
  { name: 'Rapid Root', title: 'The Tempo Setter', chapter: 'Logic Circuit', category: 'addition', lesson: 'Keep place value organised as the pace increases.', mission: 'Match Root’s speed without sacrificing accuracy.' },
  { name: 'Prime Hunter', title: 'The Factor Tracker', chapter: 'Logic Circuit', category: 'multiplication', lesson: 'Spot factor relationships in harder products.', mission: 'Hunt down every multiplication result.' },
  { name: 'Equation Echo', title: 'The Reverse Thinker', chapter: 'Logic Circuit', category: 'division', lesson: 'Use inverse operations to verify each quotient.', mission: 'Silence Echo with exact division.' },
  { name: 'Logic Lance', title: 'The Sequence Guard', chapter: 'Logic Circuit', category: 'order_of_ops', lesson: 'Follow operation order through multi-step expressions.', mission: 'Complete Lance’s multi-step gauntlet.' },
  { name: 'Fraction Phantom', title: 'The Denominator', chapter: 'Logic Circuit', category: 'fractions', lesson: 'Handle unlike denominators and negative results.', mission: 'Expose Phantom’s fraction tricks.' },
  { name: 'Quantum Quinn', title: 'The Number Bender', chapter: 'Masters Arena', category: 'addition', lesson: 'Add positive and negative values under pressure.', mission: 'Defeat Quinn in a signed-number duel.' },
  { name: 'Cipher Storm', title: 'The Sign Master', chapter: 'Masters Arena', category: 'subtraction', lesson: 'Control double negatives and large differences.', mission: 'Survive Storm’s signed subtraction round.' },
  { name: 'Omega Solver', title: 'The Rule Engine', chapter: 'Masters Arena', category: 'order_of_ops', lesson: 'Resolve complex expressions in the correct sequence.', mission: 'Solve Omega’s operation-order trial.' },
  { name: 'Arena Titan', title: 'The Product Colossus', chapter: 'Masters Arena', category: 'multiplication', lesson: 'Multiply signed values quickly and consistently.', mission: 'Bring down Titan with precise products.' },
  { name: 'Math Master', title: 'The Final Champion', chapter: 'Masters Arena', category: 'fractions', lesson: 'Combine fraction fluency, signs, and speed.', mission: 'Claim the arena by defeating the final champion.' },
]

export const BOT_LEVELS: BotLevelConfig[] = RIVALS.map((rival, index) => {
  const level = index + 1
  return {
    ...rival,
    level,
    difficulty: level <= 6 ? 'easy' : level <= 14 ? 'medium' : 'hard',
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
  const config = BOT_LEVELS[level - 1]
  if (!config) throw new RangeError(`Unknown bot campaign level: ${level}`)
  return config
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