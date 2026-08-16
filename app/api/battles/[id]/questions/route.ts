import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type BattleRow = {
  id: string
  host_id: string | null
  guest_id: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: battle, error: battleError } = await admin
    .from('battles')
    .select('id, host_id, guest_id')
    .eq('id', id)
    .single()

  if (battleError || !battle) {
    return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  }

  const battleRow = battle as BattleRow
  if (battleRow.host_id !== user.id && battleRow.guest_id !== user.id) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  const { data: questions, error: questionsError } = await admin
    .from('battle_questions')
    .select('id, battle_id, sequence, question_text, category, difficulty, server_sent_at')
    .eq('battle_id', id)
    .order('sequence')

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 })
  }

  return NextResponse.json({ questions: questions ?? [] })
}
