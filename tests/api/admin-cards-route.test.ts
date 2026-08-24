import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/admin-guard'
import { POST } from '@/app/api/admin/cards/route'
import { PATCH } from '@/app/api/admin/cards/[id]/route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/admin-guard', () => ({ requireAdmin: vi.fn() }))

function jsonRequest(body: unknown) {
  return new Request('http://test.local/api/admin/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/cards', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(createAdminClient).mockReset()
  })

  it('requires an administrator before creating a card', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null)

    const response = await POST(jsonRequest({}))

    expect(response.status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('validates card rarity and drop weight', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)

    const response = await POST(jsonRequest({
      name: 'Test card', description: '', rarity: 'mythic', image_url: '', drop_weight: 0,
    }))

    expect(response.status).toBe(400)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('creates a normalized card', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
    const card = { id: 'card-1', name: 'Prime', rarity: 'rare', drop_weight: 12, is_active: true }
    const admin = createSupabaseMock({ fromResults: [{ data: card, error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await POST(jsonRequest({
      name: '  Prime  ', description: ' Number card ', rarity: 'rare', image_url: ' https://example.com/card.png ', drop_weight: 12,
    }))
    const query = admin.from.mock.results[0].value

    expect(response.status).toBe(201)
    expect(query.insert).toHaveBeenCalledWith({
      name: 'Prime', description: 'Number card', rarity: 'rare',
      image_url: 'https://example.com/card.png', drop_weight: 12, is_active: true,
    })
  })

  it('patches only validated card fields', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-1' } as never)
    const card = { id: 'card-1', is_active: false }
    const admin = createSupabaseMock({ fromResults: [{ data: card, error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await PATCH(jsonRequest({ is_active: false }), {
      params: Promise.resolve({ id: 'card-1' }),
    })
    const query = admin.from.mock.results[0].value

    expect(response.status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({ is_active: false })
    expect(query.eq).toHaveBeenCalledWith('id', 'card-1')
  })
})
