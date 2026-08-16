import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET } from '@/app/api/battles/[id]/review/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('GET /api/battles/[id]/review', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('returns measured categories and the requesting player reward receipt', async () => {
    const reward = {
      xp_earned: 220,
      coins_earned: 220,
      rating_delta: 16,
      xp_before: 900,
      xp_after: 1120,
      level_before: 4,
      level_after: 5,
    }
    const admin = createSupabaseMock({
      fromResults: [
        { data: { id: 'battle-1', host_id: 'user-1', guest_id: 'user-2', status: 'finished' } },
        { data: [{ question_id: 'question-1', answer_given: 10, is_correct: false, points_earned: 0 }] },
        { data: [{ id: 'question-1', sequence: 1, question_text: '96 ÷ 8', correct_answer: 12, category: 'division' }] },
        { data: reward },
      ],
    })

    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET(new Request('http://test.local'), {
      params: Promise.resolve({ id: 'battle-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      review: [{
        sequence: 1,
        questionText: '96 ÷ 8',
        category: 'division',
        answerGiven: 10,
        isCorrect: false,
        correctAnswer: 12,
        points: 0,
      }],
      reward,
    })
  })
})