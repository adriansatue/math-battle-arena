import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { invite_code } = await request.json()

  if (!invite_code) {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
  }

  // Find battle by invite code
  const { data: battle, error: battleError } = await adminSupabase
    .from('battles')
    .select('*')
    .eq('invite_code', invite_code.toUpperCase().trim())
    .eq('status', 'waiting')
    .single()

  if (battleError || !battle) {
    return NextResponse.json({ error: 'Battle not found or already started' }, { status: 404 })
  }

  // Can't join your own battle
  if (battle.host_id === user.id) {
    return NextResponse.json({ error: 'You cannot join your own battle' }, { status: 400 })
  }

  // Join the battle as guest
  const { error: joinError } = await adminSupabase
    .from('battles')
    .update({ guest_id: user.id })
    .eq('id', battle.id)

  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 500 })
  }

  return NextResponse.json({ battle_id: battle.id, mode: battle.mode, difficulty: battle.difficulty })
}