import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Registered account required' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_weekly_competition_summary', {
    p_user_id: user.id,
  })
  if (error) return NextResponse.json({ error: 'Could not load weekly competition' }, { status: 500 })

  const summary = data as { leaderboard?: { user_id: string }[] }
  const userIds = summary.leaderboard?.map(entry => entry.user_id) ?? []
  const { data: identities, error: identitiesError } = await admin.rpc('get_registered_player_emblems', {
    p_user_ids: userIds,
  })
  if (identitiesError) {
    console.error('[weekly-competition] emblem lookup failed:', identitiesError.message)
    return NextResponse.json(summary)
  }

  const identityMap = new Map((Array.isArray(identities) ? identities : []).map(identity => [identity.id, identity.emblem]))
  return NextResponse.json({
    ...summary,
    leaderboard: (summary.leaderboard ?? [])
      .filter(entry => identityMap.has(entry.user_id))
      .map(entry => ({ ...entry, emblem: identityMap.get(entry.user_id) ?? null })),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Registered account required' }, { status: 401 })

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
