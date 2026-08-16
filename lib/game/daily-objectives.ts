export const DAILY_OBJECTIVE_COPY = {
  correct_15: {
    title: 'Sharp answers',
    description: 'Answer 15 questions correctly',
  },
  complete_battle: {
    title: 'Daily challenge',
    description: 'Complete one battle against a player or bot',
  },
  focused_practice: {
    title: 'Focused improvement',
    description: 'Complete a recommended practice session',
  },
} as const

export type DailyObjectiveKey = keyof typeof DAILY_OBJECTIVE_COPY

export type DailyObjective = {
  key: DailyObjectiveKey
  target: number
  progress: number
  reward_coins: number
  completed: boolean
  claimed: boolean
}

export type ActivityStreaks = {
  current_days: number
  best_days: number
  total_days: number
  current_weeks: number
  best_weeks: number
  total_weeks: number
}

export type DailyObjectiveSummary = {
  date: string
  timezone: 'UTC'
  resets_at: string
  objectives: DailyObjective[]
  streaks: ActivityStreaks
}

export function objectivePercent(objective: DailyObjective) {
  return Math.min(100, Math.round((objective.progress / Math.max(1, objective.target)) * 100))
}