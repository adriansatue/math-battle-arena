export const MAX_LEVEL = 100

const XP_CURVE_BASE = 100
const XP_CURVE_EXPONENT = 1.7

const RANK_TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 91, title: 'Grand Mathematician' },
  { minLevel: 81, title: 'Elite Mathematician' },
  { minLevel: 71, title: 'Battle Contender' },
  { minLevel: 61, title: 'Algebra Expert' },
  { minLevel: 51, title: 'Fraction Specialist' },
  { minLevel: 41, title: 'Formula Strategist' },
  { minLevel: 31, title: 'Equation Solver' },
  { minLevel: 21, title: 'Times Table Trainer' },
  { minLevel: 11, title: 'Number Builder' },
  { minLevel: 1,  title: 'Math Rookie' },
]

export function getLevelThreshold(level: number): number {
  const safeLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)))
  if (safeLevel <= 1) return 0

  return Math.round(XP_CURVE_BASE * Math.pow(safeLevel - 1, XP_CURVE_EXPONENT))
}

export function getRankTitleForLevel(level: number): string {
  const safeLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)))
  return RANK_TITLES.find(tier => safeLevel >= tier.minLevel)?.title ?? 'Math Rookie'
}

export const LEVEL_THRESHOLDS: { min: number; level: number; title: string }[] =
  Array.from({ length: MAX_LEVEL }, (_, index) => {
    const level = index + 1
    return {
      min: getLevelThreshold(level),
      level,
      title: getRankTitleForLevel(level),
    }
  })

export function getLevelAndRank(totalXp: number): { level: number; rank_title: string } {
  const xp = Math.max(0, Math.round(totalXp))
  let result = LEVEL_THRESHOLDS[0]

  for (const tier of LEVEL_THRESHOLDS) {
    if (xp >= tier.min) result = tier
    else break
  }

  return {
    level: result.level,
    rank_title: result.title,
  }
}

export function getLevelProgress(totalXp: number) {
  const xp = Math.max(0, Math.round(totalXp))
  const { level, rank_title: rankTitle } = getLevelAndRank(xp)
  const currentThreshold = getLevelThreshold(level)
  const nextThreshold = level >= MAX_LEVEL
    ? currentThreshold
    : getLevelThreshold(level + 1)
  const xpForNextLevel = Math.max(0, nextThreshold - currentThreshold)
  const xpIntoLevel = Math.max(0, xp - currentThreshold)
  const progressPercent = level >= MAX_LEVEL || xpForNextLevel === 0
    ? 100
    : Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)))

  return {
    level,
    rankTitle,
    currentThreshold,
    nextThreshold,
    xpForNextLevel,
    xpIntoLevel,
    xpToNextLevel: Math.max(0, nextThreshold - xp),
    progressPercent,
    isMaxLevel: level >= MAX_LEVEL,
  }
}
