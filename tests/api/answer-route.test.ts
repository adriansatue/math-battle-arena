import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/battles/[id]/answer/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('POST /api/battles/[id]/answer', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('returns a conflict for a concurrent duplicate answer insert', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'host-1' },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock({
      fromResults: [
        {
          data: {
            id:             'question-1',
            battle_id:      'battle-1',
            correct_answer: 2,
            sequence:       1,
            server_sent_at: new Date().toISOString(),
          },
          error: null,
        },
        {
          data: {
            id:               'battle-1',
            host_id:          'host-1',
            guest_id:         'guest-1',
            status:           'active',
            mode:             'turnbased',
            difficulty:       'easy',
            time_per_q_secs:  10,
          },
          error: null,
        },
        { data: null, error: null },
        { data: [], error: null },
        {
          data:  null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        },
      ],
    }) as never)

    const res = await POST(jsonRequest({
      question_id:    'question-1',
      answer_given:   3,
      time_taken_ms:  1000,
    }), { params: Promise.resolve({ id: 'battle-1' }) })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: 'Already answered' })
  })

  it('replays the stored result when the same answer is retried', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'host-1' },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock({
      fromResults: [
        {
          data: {
            id:             'question-1',
            battle_id:      'battle-1',
            correct_answer: 2,
            sequence:       1,
            server_sent_at: new Date().toISOString(),
          },
          error: null,
        },
        {
          data: {
            id:               'battle-1',
            host_id:          'host-1',
            guest_id:         'guest-1',
            status:           'active',
            mode:             'turnbased',
            difficulty:       'easy',
            time_per_q_secs:  10,
          },
          error: null,
        },
        {
          data: {
            answer_given:  2,
            is_correct:    true,
            points_earned: 125,
          },
          error: null,
        },
        {
          data: [
            { is_correct: true, answered_at: new Date().toISOString() },
            { is_correct: true, answered_at: new Date().toISOString() },
          ],
          error: null,
        },
      ],
    }) as never)

    const res = await POST(jsonRequest({
      question_id:   'question-1',
      answer_given:  2,
      time_taken_ms: 1000,
    }), { params: Promise.resolve({ id: 'battle-1' }) })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      is_correct:    true,
      points_earned: 125,
      current_streak: 2,
      recovered:     true,
    })
  })

  it('rejects answering a later question before the previous one is saved', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'host-1' },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock({
      fromResults: [
        {
          data: {
            id:             'question-2',
            battle_id:      'battle-1',
            correct_answer: 4,
            sequence:       2,
            server_sent_at: new Date().toISOString(),
          },
          error: null,
        },
        {
          data: {
            id:               'battle-1',
            host_id:          'host-1',
            guest_id:         'guest-1',
            status:           'active',
            mode:             'turnbased',
            difficulty:       'easy',
            time_per_q_secs:  10,
          },
          error: null,
        },
        { data: null, error: null },
        { data: [], error: null },
      ],
    }) as never)

    const res = await POST(jsonRequest({
      question_id:    'question-2',
      answer_given:   4,
      time_taken_ms:  1000,
    }), { params: Promise.resolve({ id: 'battle-1' }) })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: 'Previous question is not answered yet' })
  })
})
