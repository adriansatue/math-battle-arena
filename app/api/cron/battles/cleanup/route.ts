import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanupInactiveBattles } from '@/lib/game/battle-cleanup'

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'

  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const result = await cleanupInactiveBattles(admin)

  return NextResponse.json({
    ok: true,
    ...result,
  })
}
