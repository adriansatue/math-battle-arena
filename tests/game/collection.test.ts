import { describe, expect, it } from 'vitest'
import { packProgress } from '@/lib/game/collection'

describe('packProgress', () => {
  it('shows remaining coins and caps visible progress', () => {
    expect(packProgress(120, 'basic')).toEqual({ cost: 300, remaining: 180, percent: 40 })
    expect(packProgress(2_000, 'legendary')).toEqual({ cost: 1800, remaining: 0, percent: 100 })
  })
})