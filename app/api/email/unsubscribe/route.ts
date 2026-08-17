import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function unsubscribe(token: string | null) {
  if (!token || !UUID_PATTERN.test(token)) return false
  const { data, error } = await createAdminClient().from('user_email_preferences').update({
    reengagement_opt_in: false,
    unsubscribed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('unsubscribe_token', token).select('user_id').maybeSingle()
  return !error && Boolean(data)
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const destination = new URL('/email/unsubscribe', request.url)
  if (token) destination.searchParams.set('token', token)
  return NextResponse.redirect(destination)
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  return NextResponse.json({ unsubscribed: await unsubscribe(token) })
}
