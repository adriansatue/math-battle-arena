import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const campaign = new URL(request.url).searchParams.get('campaign')
  const destination = new URL('/lobby?source=reengagement_email', request.url)
  if (!token || !UUID_PATTERN.test(token) || !campaign || !/^reactivation-\d{4}-\d{2}-\d{2}$/.test(campaign)) {
    return NextResponse.redirect(destination)
  }

  const admin = createAdminClient()
  const { data: preference } = await admin.from('user_email_preferences')
    .select('user_id').eq('unsubscribe_token', token).maybeSingle()
  if (preference?.user_id) {
    await admin.from('email_delivery_log').update({ clicked_at: new Date().toISOString() })
      .eq('user_id', preference.user_id).eq('campaign_key', campaign).eq('status', 'sent').is('clicked_at', null)
  }
  return NextResponse.redirect(destination)
}
