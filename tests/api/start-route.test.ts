import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/battles/[id]/start/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/game/questions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/game/questions')>()
  return {
    ...actual,
    generateQuestions: vi.fn(() => [{
      question_text:  '1 + 1',
      correct_answer: 2,
      category:       'addition',
      difficulty:     'easy',
    }]),
  }
})

const battleId = 'battle-1'
const hostId = 'host-1'

describe('POST /api/battles/[id]/start', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('rejects starting without an opponent', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user:        { id: hostId },
      fromResults: [{ data: waitingBattle({ guest_id: null }), error: null }],
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock() as never)

    const res = await POST(jsonRequest({}), { params: Promise.resolve({ id: battleId }) })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Cannot start without an opponent' })
  })

  it('rejects starting with a partial stake', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user:        { id: hostId },
      fromResults: [{
        data:  waitingBattle({ guest_id: 'guest-1', host_staked_inventory_id: 'card-host' }),
        error: null,
      }],
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock() as never)

    const res = await POST(jsonRequest({}), { params: Promise.resolve({ id: battleId }) })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'bet_not_matched' })
  })

  it('rejects stale staked-card ownership', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user:        { id: hostId },
      fromResults: [{
        data: waitingBattle({
          guest_id:                  'guest-1',
          host_staked_inventory_id:  'card-host',
          guest_staked_inventory_id: 'card-guest',
        }),
        error: null,
      }],
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock({
      fromResults: [{
        data: [
          { id: 'card-host', user_id: hostId },
          { id: 'card-guest', user_id: 'someone-else' },
        ],
        error: null,
      }],
    }) as never)

    const res = await POST(jsonRequest({}), { params: Promise.resolve({ id: battleId }) })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: 'One or more staked cards are no longer available' })
  })

  it('starts with idempotent question upsert and conditional battle update', async () => {
    const admin = createSupabaseMock({
      fromResults: [
        { data: null, error: null },
        { data: { id: battleId }, error: null },
        { data: null, error: null },
      ],
    })

    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user:        { id: hostId },
      fromResults: [{ data: waitingBattle({ guest_id: 'guest-1' }), error: null }],
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(jsonRequest({}), { params: Promise.resolve({ id: battleId }) })

    expect(res.status).toBe(200)
    expect(admin.from).toHaveBeenCalledWith('battle_questions')
    expect(admin.from).toHaveBeenCalledWith('battles')
    await expect(res.json()).resolves.toMatchObject({ message: 'Battle started!' })
  })
})

function waitingBattle(overrides: Record<string, unknown>) {
  return {
    id:                         battleId,
    host_id:                    hostId,
    guest_id:                   'guest-1',
    status:                     'waiting',
    difficulty:                 'easy',
    question_count:             1,
    host_staked_inventory_id:   null,
    guest_staked_inventory_id:  null,
    ...overrides,
  }
}
