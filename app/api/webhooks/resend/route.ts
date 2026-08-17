import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

type SuppressionEvent = {
  type: 'email.bounced' | 'email.complained' | 'email.suppressed'
  data: { email_id: string }
}

type NewsletterOptOutEvent = {
  type: 'contact.updated' | 'suppression.added'
  data: { email: string; unsubscribed?: boolean }
}

export async function applySuppressionEvent(event: SuppressionEvent) {
  const admin = createAdminClient()
  const { data: delivery } = await admin.from('email_delivery_log')
    .select('user_id')
    .eq('provider_message_id', event.data.email_id)
    .maybeSingle()
  if (!delivery?.user_id) return false

  const now = new Date().toISOString()
  await Promise.all([
    admin.from('user_email_preferences').update({
      reengagement_opt_in: false,
      unsubscribed_at: now,
      updated_at: now,
    }).eq('user_id', delivery.user_id),
    admin.from('email_delivery_log').update({
      status: 'failed',
      error_code: event.type.replace('email.', ''),
    }).eq('provider_message_id', event.data.email_id),
  ])
  return true
}

export async function applyNewsletterOptOut(event: NewsletterOptOutEvent) {
  if (event.type === 'contact.updated' && event.data.unsubscribed !== true) return false
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('unsubscribe_newsletter_by_email', {
    p_email: event.data.email,
  })
  return !error && data === true
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })

  const payload = await request.text()
  try {
    const event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: request.headers.get('svix-id') ?? '',
        timestamp: request.headers.get('svix-timestamp') ?? '',
        signature: request.headers.get('svix-signature') ?? '',
      },
      webhookSecret,
    })

    if (event.type === 'email.bounced' || event.type === 'email.complained' || event.type === 'email.suppressed') {
      await applySuppressionEvent(event)
    }
    if (event.type === 'contact.updated' || event.type === 'suppression.added') {
      await applyNewsletterOptOut(event)
    }
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }
}
