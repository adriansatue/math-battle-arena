import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/admin-guard'

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('battle_answers')
    .select(`
      id, answer_given, time_taken_ms, server_validated_ms,
      points_earned, answered_at, player_id,
      profiles ( username ),
      battle_questions ( question_text, correct_answer )
    `)
    .eq('flagged', true)
    .order('answered_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ answers: data ?? [] })
}

export async function PATCH() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('battle_answers')
    .update({ flagged: false })
    .eq('flagged', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
