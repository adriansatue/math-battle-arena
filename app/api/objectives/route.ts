import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DAILY_OBJECTIVE_COPY, type DailyObjectiveKey } from '@/lib/game/daily-objectives'
import { recordServerEvent } from '@/lib/events/server'

function isObjectiveKey(value: unknown): value is DailyObjectiveKey {
  return typeof value === 'string' && value in DAILY_OBJECTIVE_COPY
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_daily_objective_summary', {
    p_user_id: user.id,
  })

  if (error) {
    console.error('[objectives] summary error:', error.message)
    return NextResponse.json({ error: 'Could not load daily objectives' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (!isObjectiveKey(body.objective_key)) {
    return NextResponse.json({ error: 'Invalid objective' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('claim_daily_objective', {
    p_user_id: user.id,
    p_objective_key: body.objective_key,
  })

  if (error) {
    return NextResponse.json({ error: 'Objective is incomplete or already claimed' }, { status: 409 })
  }

  const claim = Array.isArray(data) ? data[0] ?? null : data
  if (claim) {
    await recordServerEvent({
      userId: user.id,
      eventName: 'daily_objective_claimed',
      dedupKey: `daily:${new Date().toISOString().slice(0, 10)}:${body.objective_key}`,
      properties: {
        objective_key: body.objective_key,
        reward_coins: claim.reward_coins,
      },
    })
  }
  return NextResponse.json({ claim })
}