import type { Difficulty } from './questions'

export type RewardMode = 'practice' | 'bot' | 'pvp'

export const DIFFICULTY_BASE_POINTS: Record<Difficulty, number> = {
  easy:   80,
  medium: 120,
  hard:   180,
}

export const DIFFICULTY_SPEED_BONUS: Record<Difficulty, number> = {
  easy:   15,
  medium: 25,
  hard:   35,
}

export const MODE_COIN_RATE: Record<RewardMode, number> = {
  practice: 0.25,
  bot:      0.5,
  pvp:      1,
}

export const WIN_XP_BONUS: Record<RewardMode, number> = {
  practice: 0,
  bot:      75,
  pvp:      150,
}

export const FIRST_ANSWER_BONUS = 20
export const DEFAULT_RATING = 1000
const RATING_K_FACTOR = 32

interface ScoreParams {
  difficulty: Difficulty
  isCorrect: boolean
  timeTakenMs: number
  timeLimitSecs: number
  isFirstAnswer: boolean
  currentStreak: number
}

export type ScoreBreakdown = {
  total: number
  base: number
  speedBonus: number
  firstAnswerBonus: number
  streakBonus: number
  nextStreak: number
}

export type BattleRewardParams = {
  mode: RewardMode
  answerXp: number
  isWinner: boolean
  isDraw: boolean
  ownRating?: number | null
  opponentRating?: number | null
}

export type BattleRewards = {
  xpEarned: number
  coinsEarned: number
  winBonusXp: number
  ratingDelta: number
}

export function calculateScoreBreakdown(params: ScoreParams): ScoreBreakdown {
  if (!params.isCorrect) {
    return {
      total:            0,
      base:             0,
      speedBonus:       0,
      firstAnswerBonus: 0,
      streakBonus:      0,
      nextStreak:       0,
    }
  }

  const {
    difficulty,
    timeTakenMs,
    timeLimitSecs,
    isFirstAnswer,
    currentStreak,
  } = params

  const timeLimitMs = Math.max(1, timeLimitSecs * 1000)
  const boundedTimeTaken = Math.max(0, timeTakenMs)
  const timeRatio = Math.min(1, Math.max(0, boundedTimeTaken / timeLimitMs))
  const remainingRatio = 1 - timeRatio

  // Speed helps close races, but it should not dominate accuracy or difficulty.
  const speedBonus = Math.round(DIFFICULTY_SPEED_BONUS[difficulty] * remainingRatio * remainingRatio)
  const firstAnswerBonus = isFirstAnswer ? FIRST_ANSWER_BONUS : 0
  const nextStreak = currentStreak + 1
  const streakBonus = calculateStreakBonus(nextStreak)
  const base = DIFFICULTY_BASE_POINTS[difficulty]

  return {
    total: base + speedBonus + firstAnswerBonus + streakBonus,
    base,
    speedBonus,
    firstAnswerBonus,
    streakBonus,
    nextStreak,
  }
}

export function calculatePoints(params: ScoreParams): number {
  return calculateScoreBreakdown(params).total
}

export function calculateStreakBonus(nextStreak: number): number {
  if (nextStreak >= 8) return 35
  if (nextStreak >= 5) return 20
  if (nextStreak >= 3) return 10
  return 0
}

export function calculateBattleRewards(params: BattleRewardParams): BattleRewards {
  const answerXp = Math.max(0, Math.round(params.answerXp))
  const winBonusXp = params.isWinner ? WIN_XP_BONUS[params.mode] : 0
  const xpEarned = answerXp + winBonusXp
  const coinsEarned = Math.max(0, Math.round(xpEarned * MODE_COIN_RATE[params.mode]))
  const ratingDelta = calculateRatingDelta(params)

  return {
    xpEarned,
    coinsEarned,
    winBonusXp,
    ratingDelta,
  }
}

export function calculateRatingDelta(params: BattleRewardParams): number {
  if (params.mode !== 'pvp') return 0

  const ownRating = params.ownRating ?? DEFAULT_RATING
  const opponentRating = params.opponentRating ?? DEFAULT_RATING
  const actualScore = params.isDraw ? 0.5 : params.isWinner ? 1 : 0
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - ownRating) / 400))

  return Math.round(RATING_K_FACTOR * (actualScore - expectedScore))
}

export function getRewardMode(battle: { guest_id?: string | null; bot_id?: string | null }): RewardMode {
  if (!battle.guest_id) return 'practice'
  if (battle.bot_id) return 'bot'
  return 'pvp'
}

// Level + rank computed from total_points, which now represents lifetime XP.
const LEVEL_THRESHOLDS: { min: number; level: number; title: string }[] = [
  { min:      0, level: 1, title: 'Math Rookie'    },
  { min:    500, level: 2, title: 'Number Cruncher' },
  { min:   1500, level: 3, title: 'Equation Solver' },
  { min:   3500, level: 4, title: 'Formula Master'  },
  { min:   7000, level: 5, title: 'Calc Wizard'     },
  { min:  12000, level: 6, title: 'Algebra Champion' },
  { min:  20000, level: 7, title: 'Math Prodigy'    },
  { min:  35000, level: 8, title: 'Grand Mathematician' },
]

export function getLevelAndRank(totalPoints: number): { level: number; rank_title: string } {
  let result = LEVEL_THRESHOLDS[0]
  for (const tier of LEVEL_THRESHOLDS) {
    if (totalPoints >= tier.min) result = tier
  }
  return { level: result.level, rank_title: result.title }
}

// Detect suspicious timing
export function isFlagged(
  clientMs: number,
  serverMs: number,
  timeLimitSecs: number
): boolean {
  const timeLimitMs = timeLimitSecs * 1000
  if (serverMs > timeLimitMs + 2_000) return true
  if (clientMs < serverMs - 5_000) return true
  if (clientMs < 100 && serverMs < 100) return true
  return false
}
