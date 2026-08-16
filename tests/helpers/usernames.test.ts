import { describe, expect, it } from 'vitest'
import { escapeLikePattern, isUsernameConflict } from '@/lib/supabase/usernames'

describe('username availability helpers', () => {
  it('escapes characters treated as patterns by ILIKE', () => {
    expect(escapeLikePattern('Cris_100%')).toBe('Cris\\_100\\%')
    expect(escapeLikePattern('Cris\\Math')).toBe('Cris\\\\Math')
  })

  it('recognizes PostgreSQL unique constraint conflicts', () => {
    expect(isUsernameConflict({ code: '23505' })).toBe(true)
    expect(isUsernameConflict({ code: '42501' })).toBe(false)
    expect(isUsernameConflict(null)).toBe(false)
  })
})