import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/battles/[id]/finish/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('POST /api/battles/[id]/finish', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('does not finish while any participant has unanswered questions', async () => {
    const admin = createSupabaseMock({
      fromResults: [
        { data: activeBattle(), error: null },
        { data: [{ player_id: 'host-1', points_earned: 100 }], error: null },
      ],
    })

    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'host-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(jsonRequest({}), { params: Promise.resolve({ id: 'battle-1' }) })

    expect(res.status).toBe(409)
    expect(admin.rpc).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toMatchObject({ error: 'Battle still in progress' })
  })

  it('uses the idempotent battle settlement RPC after marking a battle finished', async () => {
    const admin = createSupabaseMock({
      fromResults: [
        { data: activeBattle(), error: null },
        {
          data: [
            { player_id: 'host-1', points_earned: 100, flagged: false },
            { player_id: 'guest-1', points_earned: 50, flagged: false },
          ],
          error: null,
        },
        { data: { id: 'battle-1' }, error: null },
        {
          data: [
            { id: 'host-1', rating: 1000 },
            { id: 'guest-1', rating: 1000 },
          ],
          error: null,
        },
      ],
      rpcResults: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    })

    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'host-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(jsonRequest({}), { params: Promise.resolve({ id: 'battle-1' }) })

    expect(res.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledTimes(2)
    expect(admin.rpc).toHaveBeenCalledWith('settle_profile_battle_result', {
      p_battle_id:    'battle-1',
      p_profile_id:   'host-1',
      p_earned_xp:    250,
      p_earned_coins: 250,
      p_is_winner:    true,
      p_is_draw:      false,
      p_record_match: true,
      p_rating_delta: 16,
    })
    expect(admin.rpc).toHaveBeenCalledWith('settle_profile_battle_result', {
      p_battle_id:    'battle-1',
      p_profile_id:   'guest-1',
      p_earned_xp:    50,
      p_earned_coins: 50,
      p_is_winner:    false,
      p_is_draw:      false,
      p_record_match: true,
      p_rating_delta: -16,
    })
    await expect(res.json()).resolves.toMatchObject({
      winner_id:   'host-1',
      host_score:  100,
      guest_score: 50,
    })
  })

  it('returns the persisted focused-practice comparison after settlement', async () => {
    const practiceSummary = {
      battle_id: 'battle-1',
      user_id: 'host-1',
      topic: 'division',
      difficulty: 'easy',
      source: 'results',
      baseline_attempts: 20,
      baseline_correct: 12,
      baseline_avg_ms: 5000,
      previous_best_accuracy: 0.7,
      session_attempts: 10,
      session_correct: 8,
      session_avg_ms: 4200,
    }
    const admin = createSupabaseMock({
      fromResults: [
        { data: { ...activeBattle(), guest_id: null }, error: null },
        { data: [{ player_id: 'host-1', points_earned: 100, flagged: false }], error: null },
        { data: { id: 'battle-1' }, error: null },
      ],
      rpcResults: [
        { data: [{ battle_id: 'battle-1', user_id: 'host-1' }], error: null },
        { data: [practiceSummary], error: null },
      ],
    })

    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'host-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await POST(jsonRequest({}), { params: Promise.resolve({ id: 'battle-1' }) })

    expect(response.status).toBe(200)
    expect(admin.rpc).toHaveBeenCalledWith('complete_focused_practice', {
      p_battle_id: 'battle-1',
      p_user_id: 'host-1',
    })
    await expect(response.json()).resolves.toMatchObject({ practice_summary: practiceSummary })
  })
})

function activeBattle() {
  return {
    id:                         'battle-1',
    host_id:                    'host-1',
    guest_id:                   'guest-1',
    status:                     'active',
    question_count:             1,
    bet_status:                 'none',
    host_staked_inventory_id:   null,
    guest_staked_inventory_id:  null,
  }
}
