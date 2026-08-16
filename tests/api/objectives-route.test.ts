import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET, POST } from '@/app/api/objectives/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('/api/objectives', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('loads the current UTC objective and activity summary', async () => {
    const summary = { date: '2026-08-16', timezone: 'UTC', objectives: [], streaks: {} }
    const admin = createSupabaseMock({ rpcResults: [{ data: summary, error: null }] })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('get_daily_objective_summary', { p_user_id: 'user-1' })
    await expect(response.json()).resolves.toEqual(summary)
  })

  it('rejects unknown objective keys before calling the database', async () => {
    const admin = createSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await POST(jsonRequest({ objective_key: 'buy_a_pack' }))

    expect(response.status).toBe(400)
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it('claims a completed objective through the atomic RPC', async () => {
    const claim = { objective_key: 'correct_15', reward_coins: 20, points_balance: 120 }
    const admin = createSupabaseMock({ rpcResults: [{ data: [claim], error: null }] })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await POST(jsonRequest({ objective_key: 'correct_15' }))

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('claim_daily_objective', {
      p_user_id: 'user-1',
      p_objective_key: 'correct_15',
    })
    await expect(response.json()).resolves.toEqual({ claim })
  })
})