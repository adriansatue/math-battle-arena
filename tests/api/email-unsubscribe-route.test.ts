import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { GET, POST } from '@/app/api/email/unsubscribe/route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

const token = '296c5870-e5e4-4535-a267-4be8da67fbe9'

describe('/api/email/unsubscribe', () => {
  it('does not unsubscribe on GET link scans', async () => {
    const admin = createSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    const response = await GET(new Request(`http://localhost/api/email/unsubscribe?token=${token}`))
    expect(response.status).toBe(307)
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('unsubscribes through the one-click POST contract', async () => {
    const admin = createSupabaseMock({ fromResults: [{ data: { user_id: 'user-1' }, error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    const response = await POST(new Request(`http://localhost/api/email/unsubscribe?token=${token}`, { method: 'POST' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ unsubscribed: true })
  })
})