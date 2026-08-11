import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWrongAnswers } from '@/lib/game/questions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: question } = await adminSupabase
    .from('battle_questions')
    .select('id, battle_id, correct_answer')
    .eq('id', id)
    .single()

  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const { data: battle } = await adminSupabase
    .from('battles')
    .select('id, host_id, guest_id, status')
    .eq('id', question.battle_id)
    .single()

  if (!battle) {
    return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  }

  if (battle.host_id !== user.id && battle.guest_id !== user.id) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  if (battle.status !== 'active') {
    return NextResponse.json({ error: 'Battle is not active' }, { status: 400 })
  }

  const correct = Number(question.correct_answer)
  const options = [...generateWrongAnswers(correct, 3), correct]
    .sort(() => Math.random() - 0.5)

  return NextResponse.json({ options })
}
