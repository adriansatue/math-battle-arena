import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReengagementEmail, type ReengagementCandidate } from '@/lib/email/reengagement'

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function batchSize() {
  const configured = Number(process.env.REENGAGEMENT_BATCH_SIZE ?? 10)
  return Math.min(25, Math.max(1, Number.isFinite(configured) ? Math.floor(configured) : 10))
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_reengagement_candidates', {
    p_inactive_days: 7,
    p_limit: batchSize(),
  })
  if (error) return NextResponse.json({ error: 'Could not load email candidates' }, { status: 500 })

  const candidates = (data ?? []) as ReengagementCandidate[]
  if (process.env.REENGAGEMENT_EMAIL_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, enabled: false, eligible: candidates.length, sent: 0 })
  }

  const campaignKey = `reactivation-${new Date().toISOString().slice(0, 10)}`
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const candidate of candidates) {
    const { data: reserved, error: reserveError } = await admin.rpc('reserve_reengagement_email', {
      p_user_id: candidate.user_id,
      p_campaign_key: campaignKey,
    })
    if (reserveError || reserved !== true) { skipped += 1; continue }

    try {
      const result = await sendReengagementEmail(candidate, campaignKey)
      if (result.error || !result.data?.id) {
        failed += 1
        await admin.from('email_delivery_log').update({
          status: 'failed',
          error_code: result.error?.name ?? 'provider_error',
        }).eq('user_id', candidate.user_id).eq('campaign_key', campaignKey)
        continue
      }

      sent += 1
      await admin.from('email_delivery_log').update({
        status: 'sent', provider_message_id: result.data.id, sent_at: new Date().toISOString(), error_code: null,
      }).eq('user_id', candidate.user_id).eq('campaign_key', campaignKey)
    } catch {
      failed += 1
      await admin.from('email_delivery_log').update({ status: 'failed', error_code: 'network_error' })
        .eq('user_id', candidate.user_id).eq('campaign_key', campaignKey)
    }
  }

  return NextResponse.json({ ok: true, enabled: true, eligible: candidates.length, sent, failed, skipped })
}
