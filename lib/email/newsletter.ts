import { Resend } from 'resend'

type NewsletterContacts = Pick<Resend['contacts'], 'create' | 'get' | 'update' | 'segments'>

export async function syncNewsletterSubscription(
  email: string,
  subscribed: boolean,
  contacts?: NewsletterContacts,
) {
  const apiKey = process.env.RESEND_API_KEY
  const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID
  if (!contacts && (!apiKey || !segmentId)) {
    return { ok: false, error: 'Newsletter provider is not configured' }
  }

  const client = contacts ?? new Resend(apiKey).contacts
  const resolvedSegmentId = segmentId ?? 'test-segment'
  const existing = await client.get({ email })

  if (!existing.data && existing.error?.statusCode !== 404) {
    return { ok: false, error: existing.error?.message ?? 'Could not find newsletter contact' }
  }

  if (!subscribed) {
    if (!existing.data) return { ok: true }
    const removed = await client.segments.remove({ email, segmentId: resolvedSegmentId })
    return removed.error
      ? { ok: false, error: removed.error.message }
      : { ok: true }
  }

  if (!existing.data) {
    const created = await client.create({
      email,
      unsubscribed: false,
      segments: [{ id: resolvedSegmentId }],
    })
    return created.error
      ? { ok: false, error: created.error.message }
      : { ok: true }
  }

  const updated = await client.update({ email, unsubscribed: false })
  if (updated.error) return { ok: false, error: updated.error.message }
  const added = await client.segments.add({ email, segmentId: resolvedSegmentId })
  return added.error
    ? { ok: false, error: added.error.message }
    : { ok: true }
}
