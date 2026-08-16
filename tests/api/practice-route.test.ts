import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/practice/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/battle-cleanup', () => ({ cleanupInactiveBattles: vi.fn() }))
vi.mock('@/lib/events/server', () => ({ recordServerEvent: vi.fn() }))

describe('POST /api/practice', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('rejects unsupported recommendation sources', async () => {
    const admin = createSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await POST(jsonRequest({
      category: 'division',
      difficulty: 'easy',
      source: 'external-campaign',
    }))

    expect(response.status).toBe(400)
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('records a validated focused-practice baseline before returning the session', async () => {
    const admin = createSupabaseMock({
      fromResults: [
        { data: { id: 'practice-1' }, error: null },
        { data: null, error: null },
      ],
      rpcResults: [{ data: [{ battle_id: 'practice-1' }], error: null }],
    })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await POST(jsonRequest({
      category: 'division',
      difficulty: 'easy',
      question_count: 10,
      source: 'results',
    }))

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('start_focused_practice', {
      p_battle_id: 'practice-1',
      p_user_id: 'user-1',
      p_topic: 'division',
      p_difficulty: 'easy',
      p_source: 'results',
    })
    await expect(response.json()).resolves.toEqual({ session_id: 'practice-1' })
  })
})