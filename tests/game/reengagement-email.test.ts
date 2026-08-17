import { describe, expect, it } from 'vitest'
import { buildReengagementEmail } from '@/lib/email/reengagement'

describe('buildReengagementEmail', () => {
  it('includes attributed return and separate confirmation/one-click unsubscribe links', () => {
    const email = buildReengagementEmail({
      user_id: 'user-1',
      email: 'player@example.com',
      username: '<Player>',
      unsubscribe_token: '296c5870-e5e4-4535-a267-4be8da67fbe9',
      last_activity_at: '2026-08-01T00:00:00Z',
      inactive_days: 15,
    }, 'https://math.example/', 'reactivation-2026-08-16')

    expect(email.html).toContain('&lt;Player&gt;')
    expect(email.html).toContain('/api/email/re-engagement/click?token=')
    expect(email.html).toContain('campaign=reactivation-2026-08-16')
    expect(email.unsubscribeUrl).toContain('/email/unsubscribe?token=')
    expect(email.oneClickUnsubscribeUrl).toContain('/api/email/unsubscribe?token=')
  })
})
