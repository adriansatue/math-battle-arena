import { describe, expect, it } from 'vitest'
import { isUniqueViolation } from '@/lib/supabase/errors'

describe('isUniqueViolation', () => {
  it('detects Postgres unique violation code', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(true)
  })

  it('falls back to duplicate-key messages', () => {
    expect(isUniqueViolation({ message: 'Duplicate key value violates unique constraint' })).toBe(true)
  })

  it('does not treat unrelated database errors as duplicates', () => {
    expect(isUniqueViolation({ code: '23503', message: 'foreign key violation' })).toBe(false)
  })
})
