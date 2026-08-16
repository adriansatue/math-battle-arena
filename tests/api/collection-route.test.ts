import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET, PATCH, POST } from '@/app/api/collection/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('/api/collection', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  function authenticate(admin = createSupabaseMock()) {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    return admin
  }

  it('loads server-generated collection progress', async () => {
    const progress = { selected_pack_type: 'rare', unique_cards: 12, duplicates: 3, sets: [] }
    const admin = authenticate(createSupabaseMock({ rpcResults: [{ data: progress, error: null }] }))

    const response = await GET()

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('get_collection_progress_v2', { p_user_id: 'user-1' })
    await expect(response.json()).resolves.toEqual(progress)
  })

  it('persists a validated pack goal', async () => {
    const admin = authenticate(createSupabaseMock({ rpcResults: [{ data: null, error: null }] }))

    const response = await PATCH(jsonRequest({ pack_type: 'legendary' }))

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('set_collection_preference', {
      p_user_id: 'user-1', p_pack_type: 'legendary', p_showcased_inventory_id: null,
    })
  })

  it('claims a completed set atomically', async () => {
    const claim = { set_key: 'arena_origins', reward_coins: 500, points_balance: 900 }
    const admin = authenticate(createSupabaseMock({ rpcResults: [{ data: claim, error: null }] }))

    const response = await POST(jsonRequest({ set_key: 'arena_origins' }))

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('claim_collection_set_reward_v2', {
      p_user_id: 'user-1', p_set_key: 'arena_origins',
    })
  })
})
