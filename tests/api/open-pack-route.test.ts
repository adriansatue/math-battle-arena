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

  it('returns a conflict when balance changed before charging the pack', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock({
      fromResults: [
        { data: { total_points: 1_000, points_balance: 1_000 }, error: null },
        {
          data: [
            { id: 'card-1', name: 'One', description: '', rarity: 'common', image_url: '' },
            { id: 'card-2', name: 'Two', description: '', rarity: 'uncommon', image_url: '' },
          ],
          error: null,
        },
        { data: null, error: { message: 'No rows found' } },
      ],
    }) as never)

    const res = await POST(jsonRequest({ pack_type: 'basic' }))

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Your points balance changed. Please try opening the pack again.',
    })
  })
})
