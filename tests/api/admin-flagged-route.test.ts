import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/admin-guard'
import { GET, PATCH } from '@/app/api/admin/flagged/route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/admin-guard', () => ({ requireAdmin: vi.fn() }))

describe('/api/admin/flagged', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('requires an administrator', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('returns the pending flagged answers', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
    const answers = [{ id: 'answer-1', flagged: true }]
    const admin = createSupabaseMock({ fromResults: [{ data: answers, error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ answers })
  })

  it('marks every pending answer as reviewed', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
    const admin = createSupabaseMock({ fromResults: [{ data: null, error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await PATCH()
    const query = admin.from.mock.results[0].value

    expect(response.status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({ flagged: false })
    expect(query.eq).toHaveBeenCalledWith('flagged', true)
  })
})
