import { describe, expect, it } from 'vitest'
import { getTopicInsight } from '@/lib/game/performance'

describe('topic performance insights', () => {
  it('prioritises low accuracy without overstating a small sample', () => {
    const insight = getTopicInsight({
      category: 'fractions',
      accuracy_rate: 0.42,
      total_attempts: 6,
      avg_speed_ms: 4200,
    })

    expect(insight.status).toBe('focus')
    expect(insight.accuracyPercent).toBe(42)
    expect(insight.sampleLabel).toBe('Early signal')
  })

  it('marks established high accuracy as a strong topic', () => {
    const insight = getTopicInsight({
      category: 'addition',
      accuracy_rate: 0.91,
      total_attempts: 40,
      avg_speed_ms: 1800,
    })

    expect(insight.status).toBe('strong')
    expect(insight.sampleLabel).toBe('Reliable pattern')
  })
})