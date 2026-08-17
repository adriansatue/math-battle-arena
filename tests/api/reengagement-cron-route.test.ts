import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReengagementEmail } from '@/lib/email/reengagement'
import { GET } from '@/app/api/cron/re-engagement/route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email/reengagement', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/email/reengagement')>()
  return { ...actual, sendReengagementEmail: vi.fn() }
})

describe('GET /api/cron/re-engagement', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('REENGAGEMENT_EMAIL_ENABLED', 'false')
    vi.mocked(createAdminClient).mockReset()
    vi.mocked(sendReengagementEmail).mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects requests without the cron secret', async () => {
    const response = await GET(new Request('http://localhost/api/cron/re-engagement'))
    expect(response.status).toBe(401)
  })

  it('returns only an aggregate dry run while sending is disabled', async () => {
    const admin = createSupabaseMock({ rpcResults: [{ data: [{ user_id: 'user-1' }], error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    const response = await GET(new Request('http://localhost/api/cron/re-engagement', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, enabled: false, eligible: 1, sent: 0 })
    expect(sendReengagementEmail).not.toHaveBeenCalled()
  })

  it('reserves, sends, and records one enabled delivery', async () => {
    vi.stubEnv('REENGAGEMENT_EMAIL_ENABLED', 'true')
    const candidate = {
      user_id: 'user-1', email: 'player@example.com', username: 'PlayerOne',
      unsubscribe_token: '296c5870-e5e4-4535-a267-4be8da67fbe9',
      last_activity_at: '2026-08-01T00:00:00Z', inactive_days: 15,
    }
    const admin = createSupabaseMock({
      rpcResults: [
        { data: [candidate], error: null },
        { data: true, error: null },
      ],
      fromResults: [{ data: null, error: null }],
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    vi.mocked(sendReengagementEmail).mockResolvedValue({ data: { id: 'resend-1' }, error: null } as never)

    const response = await GET(new Request('http://localhost/api/cron/re-engagement', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ enabled: true, sent: 1, failed: 0 })
    expect(sendReengagementEmail).toHaveBeenCalledWith(candidate, expect.stringMatching(/^reactivation-/))
    const deliveryQuery = admin.from.mock.results[0].value
    expect(deliveryQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'sent', provider_message_id: 'resend-1',
    }))
  })
})
