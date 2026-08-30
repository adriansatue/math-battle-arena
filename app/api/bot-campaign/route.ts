import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BOT_LEVELS } from '@/lib/game/bot'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const battleId = new URL(request.url).searchParams.get('battle_id')
  const admin = createAdminClient()
  const { data, error } = battleId
    ? await admin.rpc('get_bot_campaign_battle_result', { p_user_id: user.id, p_battle_id: battleId })
    : await admin.rpc('get_bot_campaign_progress', { p_user_id: user.id })

  if (error) return NextResponse.json({ error: 'Could not load bot campaign' }, { status: 500 })
  return NextResponse.json({ progress: data, levels: battleId ? undefined : BOT_LEVELS })
}