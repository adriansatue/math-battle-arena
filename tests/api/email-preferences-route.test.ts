import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, jsonRequest } from '../helpers/supabase'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncNewsletterSubscription } from '@/lib/email/newsletter'
import { GET, PATCH } from '@/app/api/email/preferences/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email/newsletter', () => ({ syncNewsletterSubscription: vi.fn() }))

describe('/api/email/preferences', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createAdminClient).mockReset()
    vi.mocked(syncNewsletterSubscription).mockReset()
  })

  it('defaults existing users to opted out when no preference exists', async () => {
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({ user: { id: 'user-1' } }) as never)
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock({ fromResults: [{ data: null, error: null }] }) as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reengagement_opt_in: false,
      newsletter_opt_in: false,
      newsletter_prompted_at: null,
      newsletter_decided_at: null,
      newsletter_eligible: false,
    })
  })

  it('stores explicit consent for a registered email account', async () => {
    const admin = createSupabaseMock({ fromResults: [{ data: null, error: null }] })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'user-1', email: 'player@example.com', is_anonymous: false },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await PATCH(jsonRequest({ reengagement_opt_in: true }))

    expect(response.status).toBe(200)
    const query = admin.from.mock.results[0].value
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1', reengagement_opt_in: true, unsubscribed_at: null,
    }), { onConflict: 'user_id' })
  })

  it('syncs newsletter consent before storing it', async () => {
    const admin = createSupabaseMock({ fromResults: [{ data: null, error: null }] })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'user-1', email: 'player@example.com', is_anonymous: false },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    vi.mocked(syncNewsletterSubscription).mockResolvedValue({ ok: true })

    const response = await PATCH(jsonRequest({ newsletter_opt_in: true }))

    expect(response.status).toBe(200)
    expect(syncNewsletterSubscription).toHaveBeenCalledWith('player@example.com', true)
    const query = admin.from.mock.results[0].value
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1', newsletter_opt_in: true, newsletter_unsubscribed_at: null,
      newsletter_decided_at: expect.any(String), newsletter_consent_source: 'profile',
    }), { onConflict: 'user_id' })
  })

  it('does not store newsletter consent when Resend synchronization fails', async () => {
    const admin = createSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'user-1', email: 'player@example.com', is_anonymous: false },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    vi.mocked(syncNewsletterSubscription).mockResolvedValue({
      ok: false, error: 'Provider unavailable',
    })

    const response = await PATCH(jsonRequest({ newsletter_opt_in: true }))

    expect(response.status).toBe(502)
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('records that the Lobby prompt was shown', async () => {
    const admin = createSupabaseMock({ fromResults: [{ data: null, error: null }] })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'user-1', email: 'player@example.com', is_anonymous: false },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await PATCH(jsonRequest({ newsletter_prompted: true }))

    expect(response.status).toBe(200)
    const query = admin.from.mock.results[0].value
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1', newsletter_prompted_at: expect.any(String),
    }), { onConflict: 'user_id' })
  })

  it('records a Lobby decline without contacting Resend for a new preference', async () => {
    const admin = createSupabaseMock({ fromResults: [
      { data: null, error: null },
      { data: null, error: null },
    ] })
    vi.mocked(createClient).mockResolvedValue(createSupabaseMock({
      user: { id: 'user-1', email: 'player@example.com', is_anonymous: false },
    }) as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const response = await PATCH(jsonRequest({
      newsletter_opt_in: false,
      newsletter_source: 'lobby_prompt',
    }))

    expect(response.status).toBe(200)
    expect(syncNewsletterSubscription).not.toHaveBeenCalled()
    const query = admin.from.mock.results[1].value
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      newsletter_opt_in: false,
      newsletter_decided_at: expect.any(String),
      newsletter_consent_source: 'lobby_prompt',
      newsletter_consent_version: '2026-08-16',
    }), { onConflict: 'user_id' })
  })
})
