export type PracticeComparisonInput = {
  baselineAttempts: number
  baselineCorrect: number
  baselineAvgMs: number | null
  sessionAttempts: number
  sessionCorrect: number
  sessionAvgMs: number | null
  previousBestAccuracy: number | null
}

export type PracticeProgress = {
  status: 'improved' | 'stable' | 'keep_practising' | 'first_baseline'
  accuracyBefore: number | null
  accuracyAfter: number
  accuracyChange: number | null
  speedBeforeMs: number | null
  speedAfterMs: number | null
  speedChangeMs: number | null
  isPersonalBest: boolean
  evidence: 'early' | 'comparable'
}

export function getPracticeProgress(input: PracticeComparisonInput): PracticeProgress {
  const accuracyBefore = input.baselineAttempts > 0
    ? Math.round((input.baselineCorrect / input.baselineAttempts) * 100)
    : null
  const accuracyAfter = input.sessionAttempts > 0
    ? Math.round((input.sessionCorrect / input.sessionAttempts) * 100)
    : 0
  const accuracyChange = accuracyBefore === null ? null : accuracyAfter - accuracyBefore
  const speedBeforeMs = input.baselineAvgMs
  const speedAfterMs = input.sessionAvgMs
  const speedChangeMs = speedBeforeMs !== null && speedAfterMs !== null
    ? speedAfterMs - speedBeforeMs
    : null
  const enoughEvidence = input.baselineAttempts >= 5 && input.sessionAttempts >= 5

  let status: PracticeProgress['status'] = 'first_baseline'
  if (enoughEvidence && accuracyChange !== null) {
    if (accuracyChange >= 5 || (accuracyChange >= 0 && speedChangeMs !== null && speedChangeMs <= -500)) {
      status = 'improved'
    } else if (accuracyChange <= -5) {
      status = 'keep_practising'
    } else {
      status = 'stable'
    }
  }

  return {
    status,
    accuracyBefore,
    accuracyAfter,
    accuracyChange,
    speedBeforeMs,
    speedAfterMs,
    speedChangeMs,
    isPersonalBest: input.sessionAttempts >= 5 && (
      input.previousBestAccuracy === null || accuracyAfter > Math.round(input.previousBestAccuracy * 100)
    ),
    evidence: enoughEvidence ? 'comparable' : 'early',
  }
}