import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET } from '@/app/api/battles/[id]/questions/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('GET /api/battles/[id]/questions', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('returns safe questions for a battle participant', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'host-1' },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock({
      fromResults: [
        { data: { id: 'battle-1', host_id: 'host-1', guest_id: null }, error: null },
        {
          data: [
            {
              id:             'question-1',
              battle_id:      'battle-1',
              sequence:       1,
              question_text:  '2 + 2',
              category:       'addition',
              difficulty:     'easy',
              server_sent_at: '2026-08-13T00:00:00.000Z',
            },
          ],
          error: null,
        },
      ],
    }) as never)

    const res = await GET(new Request('http://test.local'), {
      params: Promise.resolve({ id: 'battle-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.questions).toHaveLength(1)
    expect(body.questions[0]).not.toHaveProperty('correct_answer')
  })

  it('rejects users who are not in the battle', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'other-user' },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock({
      fromResults: [
        { data: { id: 'battle-1', host_id: 'host-1', guest_id: null }, error: null },
      ],
    }) as never)

    const res = await GET(new Request('http://test.local'), {
      params: Promise.resolve({ id: 'battle-1' }),
    })

    expect(res.status).toBe(403)
  })
})
