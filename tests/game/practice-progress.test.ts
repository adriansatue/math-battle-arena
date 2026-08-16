import { describe, expect, it } from 'vitest'
import { getPracticeProgress } from '@/lib/game/practice-progress'

describe('practice progress', () => {
  it('reports meaningful accuracy improvement with comparable samples', () => {
    expect(getPracticeProgress({
      baselineAttempts: 20,
      baselineCorrect: 12,
      baselineAvgMs: 5000,
      sessionAttempts: 10,
      sessionCorrect: 8,
      sessionAvgMs: 4200,
      previousBestAccuracy: 0.7,
    })).toMatchObject({
      status: 'improved',
      accuracyBefore: 60,
      accuracyAfter: 80,
      accuracyChange: 20,
      speedChangeMs: -800,
      isPersonalBest: true,
      evidence: 'comparable',
    })
  })

  it('does not claim improvement from a tiny baseline', () => {
    expect(getPracticeProgress({
      baselineAttempts: 2,
      baselineCorrect: 1,
      baselineAvgMs: 5000,
      sessionAttempts: 10,
      sessionCorrect: 10,
      sessionAvgMs: 3000,
      previousBestAccuracy: null,
    })).toMatchObject({
      status: 'first_baseline',
      evidence: 'early',
    })
  })

  it('distinguishes stable and declining accuracy', () => {
    const common = {
      baselineAttempts: 20,
      baselineCorrect: 16,
      baselineAvgMs: 4000,
      sessionAttempts: 10,
      previousBestAccuracy: 0.9,
    }
    expect(getPracticeProgress({ ...common, sessionCorrect: 8, sessionAvgMs: 3900 }).status).toBe('stable')
    expect(getPracticeProgress({ ...common, sessionCorrect: 6, sessionAvgMs: 3900 }).status).toBe('keep_practising')
  })
})