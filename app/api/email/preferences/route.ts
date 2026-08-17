import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncNewsletterSubscription } from '@/lib/email/newsletter'

const NEWSLETTER_CONSENT_VERSION = '2026-08-16'

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('user_email_preferences')
    .select('reengagement_opt_in, newsletter_opt_in, newsletter_prompted_at, newsletter_decided_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load email preferences' }, { status: 500 })
  return NextResponse.json({
    reengagement_opt_in: data?.reengagement_opt_in ?? false,
    newsletter_opt_in: data?.newsletter_opt_in ?? false,
    newsletter_prompted_at: data?.newsletter_prompted_at ?? null,
    newsletter_decided_at: data?.newsletter_decided_at ?? null,
    newsletter_eligible: !user.is_anonymous && Boolean(user.email),
  })
}

export async function PATCH(request: Request) {
  const user = await currentUser()
  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ error: 'A registered email account is required' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as {
    reengagement_opt_in?: unknown
    newsletter_opt_in?: unknown
    newsletter_prompted?: unknown
    newsletter_source?: unknown
  }
  const isReminderUpdate = typeof body.reengagement_opt_in === 'boolean'
  const isNewsletterUpdate = typeof body.newsletter_opt_in === 'boolean'
  const isPromptUpdate = body.newsletter_prompted === true
  if (Number(isReminderUpdate) + Number(isNewsletterUpdate) + Number(isPromptUpdate) !== 1) {
    return NextResponse.json({ error: 'Invalid preference' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const admin = createAdminClient()

  if (isPromptUpdate) {
    const { error } = await admin.from('user_email_preferences').upsert({
      user_id: user.id,
      newsletter_prompted_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: 'Could not record newsletter prompt' }, { status: 500 })
    return NextResponse.json({ newsletter_prompted_at: now })
  }

  const newsletterSource = body.newsletter_source === 'lobby_prompt' ? 'lobby_prompt' : 'profile'
  const preference = isReminderUpdate
    ? {
        user_id: user.id,
        reengagement_opt_in: body.reengagement_opt_in,
        opted_in_at: body.reengagement_opt_in ? now : null,
        unsubscribed_at: body.reengagement_opt_in ? null : now,
        updated_at: now,
      }
    : {
        user_id: user.id,
        newsletter_opt_in: body.newsletter_opt_in,
        newsletter_opted_in_at: body.newsletter_opt_in ? now : null,
        newsletter_unsubscribed_at: body.newsletter_opt_in ? null : now,
        newsletter_decided_at: now,
        newsletter_consent_source: newsletterSource,
        newsletter_consent_version: NEWSLETTER_CONSENT_VERSION,
        updated_at: now,
      }

  if (isNewsletterUpdate) {
    let shouldSync = body.newsletter_opt_in === true
    if (!shouldSync) {
      const { data: existing, error: existingError } = await admin.from('user_email_preferences')
        .select('newsletter_opt_in')
        .eq('user_id', user.id)
        .maybeSingle()
      if (existingError) return NextResponse.json({ error: 'Could not load email preferences' }, { status: 500 })
      shouldSync = existing?.newsletter_opt_in === true
    }
    if (shouldSync) {
      const synced = await syncNewsletterSubscription(user.email, body.newsletter_opt_in as boolean)
      if (!synced.ok) {
        const configurationError = synced.error === 'Newsletter provider is not configured'
        return NextResponse.json({
          error: configurationError ? 'Newsletter is not configured' : 'Could not update newsletter subscription',
          code: configurationError ? 'NEWSLETTER_NOT_CONFIGURED' : 'NEWSLETTER_PROVIDER_ERROR',
        }, { status: 502 })
      }
    }
  }

  const { error } = await admin.from('user_email_preferences')
    .upsert(preference, { onConflict: 'user_id' })
  if (error) {
    if (isNewsletterUpdate && body.newsletter_opt_in === true) {
      await syncNewsletterSubscription(user.email, false)
    }
    return NextResponse.json({ error: 'Could not update email preferences' }, { status: 500 })
  }
  return NextResponse.json(isReminderUpdate
    ? { reengagement_opt_in: body.reengagement_opt_in }
    : { newsletter_opt_in: body.newsletter_opt_in })
}
