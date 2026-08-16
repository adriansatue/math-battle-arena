export type WeeklyLeaderboardEntry = {
  user_id: string
  username: string
  rank: number
  xp_earned: number
  rating: number
  level: number
  battles_completed: number
  battles_won: number
  accuracy: number | null
}

export type WeeklyPersonalSummary = {
  rank: number
  xp_earned: number
  rating_change: number
  battles_completed: number
  battles_won: number
  accuracy: number | null
  accuracy_change: number | null
  best_score: number
  strongest_topic: string | null
  weakest_topic: string | null
}

export type WeeklyReward = {
  week_start: string
  rank: number
  cohort_size: number
  reward_coins: number
  claimed: boolean
}

export type WeeklyCompetitionSummary = {
  week_start: string
  week_end: string
  division: number
  division_label: string
  minimum_cohort_size: number
  leaderboard: WeeklyLeaderboardEntry[]
  personal: WeeklyPersonalSummary | null
  previous_reward: WeeklyReward | null
}

export function divisionForLevel(level: number) {
  return Math.min(10, Math.max(1, Math.floor((level - 1) / 10) + 1))
}
