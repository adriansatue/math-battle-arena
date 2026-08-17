import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyNewsletterOptOut, applySuppressionEvent } from '@/app/api/webhooks/resend/route'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

describe('Resend suppression webhook', () => {
  it('opts the owner out after a verified complaint', async () => {
    const admin = createSupabaseMock({ fromResults: [
      { data: { user_id: 'user-1' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const applied = await applySuppressionEvent({
      type: 'email.complained',
      data: { email_id: 'resend-message-1' },
    })

    expect(applied).toBe(true)
    const preferenceQuery = admin.from.mock.results[1].value
    expect(preferenceQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      reengagement_opt_in: false,
    }))
  })

  it('records a native Resend newsletter unsubscribe', async () => {
    const admin = createSupabaseMock({ rpcResults: [{ data: true, error: null }] })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    await expect(applyNewsletterOptOut({
      type: 'contact.updated',
      data: { email: 'player@example.com', unsubscribed: true },
    })).resolves.toBe(true)

    expect(admin.rpc).toHaveBeenCalledWith('unsubscribe_newsletter_by_email', {
      p_email: 'player@example.com',
    })
  })
})