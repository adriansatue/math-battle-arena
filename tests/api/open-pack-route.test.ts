import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/rewards/open-pack/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('POST /api/rewards/open-pack', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('settles balance, duplicates, and inventory through one idempotent RPC', async () => {
    const requestId = '2f55de2b-45f8-4cf8-84ec-9f4cd20497bc'
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    const admin = createSupabaseMock({
      fromResults: [
        {
          data: [
            { id: 'card-1', name: 'One', description: '', rarity: 'common', image_url: '' },
            { id: 'card-2', name: 'Two', description: '', rarity: 'uncommon', image_url: '' },
            { id: 'card-3', name: 'Three', description: '', rarity: 'common', image_url: '' },
          ],
          error: null,
        },
        { data: [], error: null },
      ],
      rpcResults: [{
        data: {
          reward_ids: ['card-1', 'card-2', 'card-3'],
          grades: [7, 8, 6],
          duplicate_count: 0,
          duplicate_reward_ids: [],
          duplicate_refund: 0,
          net_cost: 300,
          points_balance: 700,
        },
        error: null,
      }],
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(jsonRequest({ pack_type: 'basic', request_id: requestId }))

    expect(res.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('settle_pack_opening', {
      p_request_id: requestId,
      p_user_id: 'user-1',
      p_pack_type: 'basic',
      p_reward_ids: expect.arrayContaining(['card-1', 'card-2', 'card-3']),
      p_grades: expect.arrayContaining([expect.any(Number)]),
    })
    await expect(res.json()).resolves.toMatchObject({ net_cost: 300, points_balance: 700 })
  })
})
