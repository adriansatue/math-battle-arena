import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await createAdminClient().rpc('get_weekly_competition_summary', {
    p_user_id: user.id,
  })
  if (error) return NextResponse.json({ error: 'Could not load weekly competition' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { week_start?: unknown }
  if (typeof body.week_start !== 'string' || !DATE_PATTERN.test(body.week_start)) {
    return NextResponse.json({ error: 'Invalid week' }, { status: 400 })
  }

  const { data, error } = await createAdminClient().rpc('claim_weekly_competition_reward', {
    p_user_id: user.id,
    p_week_start: body.week_start,
  })
  if (error) return NextResponse.json({ error: 'Weekly reward is unavailable' }, { status: 409 })
  return NextResponse.json({ claim: Array.isArray(data) ? data[0] ?? null : data })
}
