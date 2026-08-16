import { describe, expect, it } from 'vitest'
import { divisionForLevel } from '@/lib/game/weekly-competition'

describe('divisionForLevel', () => {
  it('uses stable ten-level divisions with bounded edges', () => {
    expect(divisionForLevel(1)).toBe(1)
    expect(divisionForLevel(10)).toBe(1)
    expect(divisionForLevel(11)).toBe(2)
    expect(divisionForLevel(100)).toBe(10)
    expect(divisionForLevel(150)).toBe(10)
  })
})
