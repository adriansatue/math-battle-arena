import { describe, expect, it } from 'vitest'
import { isClientEventName, sanitizeClientProperties } from '@/lib/events/catalog'

describe('product event catalogue', () => {
  it('accepts only client events exposed by the ingestion API', () => {
    expect(isClientEventName('lobby_viewed')).toBe(true)
    expect(isClientEventName('battle_finished')).toBe(false)
    expect(isClientEventName('arbitrary_event')).toBe(false)
  })

  it('removes unknown, long, and structured client properties', () => {
    expect(sanitizeClientProperties('profile_insight_viewed', {
      primary_topic: 'division',
      insight_status: 'focus',
      sample_label: 'Reliable pattern',
      email: 'private@example.com',
      nested: { unsafe: true },
      primary_topic_extra: 'x'.repeat(100),
    })).toEqual({
      primary_topic: 'division',
      insight_status: 'focus',
      sample_label: 'Reliable pattern',
    })
  })
})