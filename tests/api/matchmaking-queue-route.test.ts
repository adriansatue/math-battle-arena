import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/matchmaking/queue/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/battle-cleanup', () => ({
  cleanupInactiveBattles: vi.fn(async () => ({ closed: 0 })),
}))

describe('POST /api/matchmaking/queue', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('matches the closest compatible queued opponent instead of the oldest candidate', async () => {
    const admin = createSupabaseMock({
      fromResults: [
        { data: null, error: null },
        { data: { rating: 1400, level: 5 }, error: null },
        {
          data: [
            { id: 'queue-old', user_id: 'old-opponent', queued_at: new Date(Date.now() - 5_000).toISOString() },
            { id: 'queue-close', user_id: 'close-opponent', queued_at: new Date(Date.now() - 3_000).toISOString() },
          ],
          error: null,
        },
        {
          data: [
            { id: 'old-opponent', rating: 900, level: 1 },
            { id: 'close-opponent', rating: 1420, level: 5 },
          ],
          error: null,
        },
        { data: { id: 'queue-close', user_id: 'close-opponent' }, error: null },
        {
          data: {
            id: 'battle-1',
            host_id: 'close-opponent',
            mode: 'realtime',
            difficulty: 'medium',
          },
          error: null,
        },
        { data: null, error: null },
        { data: null, error: null },
      ],
    })

    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(jsonRequest({ mode: 'realtime', difficulty: 'medium' }))
    const body = await res.json()
    const claimQuery = admin.from.mock.results[4].value

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      matched: true,
      battle_id: 'battle-1',
      match_quality: {
        rating_diff: 20,
        level_diff: 0,
      },
    })
    expect(claimQuery.eq).toHaveBeenCalledWith('id', 'queue-close')
  })
})
