import type { Difficulty } from './questions'

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy:   1.0,
  medium: 1.5,
  hard:   2.0,
}

const BASE_POINTS       = 100
const MAX_SPEED_BONUS   = 50
const FIRST_ANSWER_BONUS = 30
const WIN_BONUS         = 200
const STREAK_BONUS      = 30
const STREAK_THRESHOLD  = 3

interface ScoreParams {
  difficulty: Difficulty
  isCorrect: boolean
  timeTakenMs: number
  timeLimitSecs: number
  isFirstAnswer: boolean
  currentStreak: number
}

export function calculatePoints(params: ScoreParams): number {
  if (!params.isCorrect) return 0

  const {
    difficulty,
    timeTakenMs,
    timeLimitSecs,
    isFirstAnswer,
    currentStreak,
  } = params

  const multiplier    = DIFFICULTY_MULTIPLIER[difficulty]
  const timeLimitMs   = timeLimitSecs * 1000
  const timeRemaining = Math.max(0, timeLimitMs - timeTakenMs)

  // Decay formula: max_speed_bonus × (time_remaining / time_total)
  const speedBonus = Math.round(MAX_SPEED_BONUS * (timeRemaining / timeLimitMs))

  // First answer bonus (realtime mode only)
  const firstBonus = isFirstAnswer ? FIRST_ANSWER_BONUS : 0

  // Streak bonus
  const streakBonus =
    currentStreak >= STREAK_THRESHOLD ? STREAK_BONUS : 0

  const total = Math.round(BASE_POINTS * multiplier) + speedBonus + firstBonus + streakBonus

  return total
}

export function calculateWinBonus(): number {
  return WIN_BONUS
}

// Detect suspicious timing
export function isFlagged(
  clientMs: number,
  serverMs: number,
  timeLimitSecs: number
): boolean {
  const timeLimitMs = timeLimitSecs * 1000
  if (serverMs > timeLimitMs + 500)  return true  // Too late
  if (clientMs < serverMs - 2000)    return true  // Client claims faster than server
  if (serverMs < 200)                return true  // Sub-200ms is implausible
  return false
}