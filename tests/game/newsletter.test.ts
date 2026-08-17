import { describe, expect, it, vi } from 'vitest'
import { syncNewsletterSubscription } from '@/lib/email/newsletter'

function contacts(existing: boolean) {
  return {
    get: vi.fn(async () => existing
      ? { data: { id: 'contact-1' }, error: null }
      : { data: null, error: { statusCode: 404, message: 'Not found' } }),
    create: vi.fn(async () => ({ data: { id: 'contact-1' }, error: null })),
    update: vi.fn(async () => ({ data: { id: 'contact-1' }, error: null })),
    segments: {
      add: vi.fn(async () => ({ data: { id: 'segment-1' }, error: null })),
      remove: vi.fn(async () => ({ data: { id: 'segment-1' }, error: null })),
    },
  }
}

describe('newsletter segment sync', () => {
  it('creates a new subscribed contact directly in the segment', async () => {
    const client = contacts(false)
    await expect(syncNewsletterSubscription('player@example.com', true, client as never))
      .resolves.toEqual({ ok: true })
    expect(client.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'player@example.com', unsubscribed: false,
    }))
  })

  it('reactivates and adds an existing contact', async () => {
    const client = contacts(true)
    await syncNewsletterSubscription('player@example.com', true, client as never)
    expect(client.update).toHaveBeenCalledWith({ email: 'player@example.com', unsubscribed: false })
    expect(client.segments.add).toHaveBeenCalled()
  })

  it('removes an existing contact from only the newsletter segment', async () => {
    const client = contacts(true)
    await syncNewsletterSubscription('player@example.com', false, client as never)
    expect(client.segments.remove).toHaveBeenCalled()
    expect(client.update).not.toHaveBeenCalled()
  })
})