import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET, POST } from '@/app/api/weekly-competition/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('/api/weekly-competition', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('loads the authenticated player division and summary', async () => {
    const summary = { week_start: '2026-08-10', division: 2, leaderboard: [] }
    const admin = createSupabaseMock({ rpcResults: [{ data: summary, error: null }] })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('get_weekly_competition_summary', { p_user_id: 'user-1' })
    await expect(response.json()).resolves.toEqual(summary)
  })

  it('rejects an invalid reward week before calling the database', async () => {
    const admin = createSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await POST(jsonRequest({ week_start: 'last-week' }))

    expect(response.status).toBe(400)
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it('claims a closed week through the idempotent RPC', async () => {
    const claim = { week_start: '2026-08-03', final_rank: 4, reward_coins: 50 }
    const admin = createSupabaseMock({ rpcResults: [{ data: [claim], error: null }] })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await POST(jsonRequest({ week_start: '2026-08-03' }))

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('claim_weekly_competition_reward', {
      p_user_id: 'user-1', p_week_start: '2026-08-03',
    })
  })
})
