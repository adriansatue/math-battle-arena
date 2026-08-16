import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET } from '@/app/api/profile/[id]/showcase/route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('GET /api/profile/[id]/showcase', () => {
  it('returns only the selected owned showcase card', async () => {
    const card = { id: 'inventory-1', grade: 8, reward_catalog: { name: 'Count Bot', rarity: 'common', image_url: 'https://example.com/card.png' } }
    const admin = createSupabaseMock({ fromResults: [
      { data: { showcased_inventory_id: 'inventory-1' }, error: null },
      { data: card, error: null },
    ] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: '296c5870-e5e4-4535-a267-4be8da67fbe9' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ showcase: card })
  })
})