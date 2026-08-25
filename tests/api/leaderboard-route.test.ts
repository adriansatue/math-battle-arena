import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET } from '@/app/api/leaderboard/route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('/api/leaderboard', () => {
  beforeEach(() => vi.mocked(createAdminClient).mockReset())

  it('returns registered leaderboard rows with emblems', async () => {
    const players = [{ id: 'player-1', username: 'Ada', emblem: { name: 'Alpha', image_url: '/alpha.png' } }]
    const admin = createSupabaseMock({ rpcResults: [{ data: players, error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET(new Request('http://test.local/api/leaderboard?order=rating'))

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('get_registered_leaderboard', { p_order: 'rating', p_limit: 50 })
    await expect(response.json()).resolves.toEqual({ players })
  })

  it('normalizes unsupported ranking orders to XP', async () => {
    const admin = createSupabaseMock({ rpcResults: [{ data: [], error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    await GET(new Request('http://test.local/api/leaderboard?order=unsafe'))

    expect(admin.rpc).toHaveBeenCalledWith('get_registered_leaderboard', { p_order: 'xp', p_limit: 50 })
  })
})