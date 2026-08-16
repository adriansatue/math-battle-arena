import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: battle } = await adminSupabase
    .from('battles')
    .select('id, host_id, guest_id, status')
    .eq('id', id)
    .single()

  if (!battle) {
    return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  }

  if (battle.host_id !== user.id && battle.guest_id !== user.id) {
    return NextResponse.json({ error: 'Not a player in this battle' }, { status: 403 })
  }

  if (battle.status !== 'finished') {
    return NextResponse.json({ error: 'Battle is not finished' }, { status: 409 })
  }

  const [{ data: answers }, { data: questions }, { data: reward }] = await Promise.all([
    adminSupabase
      .from('battle_answers')
      .select('question_id, answer_given, is_correct, points_earned')
      .eq('battle_id', id)
      .eq('player_id', user.id),
    adminSupabase
      .from('battle_questions')
      .select('id, sequence, question_text, correct_answer, category')
      .eq('battle_id', id)
      .order('sequence'),
    adminSupabase
      .from('battle_reward_receipts')
      .select('xp_earned, coins_earned, rating_delta, xp_before, xp_after, coins_before, coins_after, rating_before, rating_after, level_before, level_after')
      .eq('battle_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  type QuestionRow = {
    id: string
    sequence: number
    question_text: string
    correct_answer: number
    category: string
  }
  type AnswerRow = {
    question_id: string
    answer_given: number | null
    is_correct: boolean
    points_earned: number
  }

  const questionMap = new Map((questions as QuestionRow[] | null ?? []).map(q => [q.id, q]))
  const review = (answers as AnswerRow[] | null ?? [])
    .map(answer => {
      const question = questionMap.get(answer.question_id)
      if (!question) return null
      return {
        sequence:      question.sequence,
        questionText:  question.question_text,
        category:      question.category,
        answerGiven:   answer.answer_given,
        isCorrect:     answer.is_correct,
        correctAnswer: answer.is_correct ? null : question.correct_answer,
        points:        answer.points_earned,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!.sequence - b!.sequence)

  return NextResponse.json({ review, reward: reward ?? null })
}
