import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const requestedOrder = new URL(request.url).searchParams.get('order')
  const order = requestedOrder === 'rating' ? 'rating' : 'xp'
  const { data, error } = await createAdminClient().rpc('get_registered_leaderboard', {
    p_order: order,
    p_limit: 50,
  })

  if (error) {
    return NextResponse.json({ error: 'Could not load leaderboard' }, { status: 500 })
  }

  return NextResponse.json({ players: Array.isArray(data) ? data : [] })
}