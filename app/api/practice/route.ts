import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timeLimits, generateTargetedQuestions } from '@/lib/game/questions'
import type { Difficulty, Category, PracticeOptions } from '@/lib/game/questions'
import { cleanupInactiveBattles } from '@/lib/game/battle-cleanup'

const CATEGORIES: Category[] = ['addition', 'subtraction', 'multiplication', 'division', 'fractions', 'order_of_ops']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

function isValidNumberOption(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1000
}

function sanitizeOptions(options: unknown): PracticeOptions {
  if (!options || typeof options !== 'object') return {}
  const input = options as Record<string, unknown>
  const sanitized: PracticeOptions = {}

  const timesTable = input.timesTable
  if (Array.isArray(timesTable)) {
    sanitized.timesTable = timesTable.filter(isValidNumberOption).filter(n => n <= 12)
  } else if (isValidNumberOption(timesTable) && timesTable <= 12) {
    sanitized.timesTable = timesTable
  }

  const divisor = input.divisor
  if (Array.isArray(divisor)) {
    sanitized.divisor = divisor.filter(isValidNumberOption).filter(n => n <= 12)
  } else if (isValidNumberOption(divisor) && divisor <= 12) {
    sanitized.divisor = divisor
  }

  if (isValidNumberOption(input.maxNumber)) {
    sanitized.maxNumber = Math.max(10, Math.min(input.maxNumber, 1000))
  }

  return sanitized
}

export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    category,
    difficulty,
    question_count = 10,
    options = {}
  } = await request.json()

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  if (!DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
  }

  if (!Number.isInteger(question_count) || question_count < 1 || question_count > 30) {
    return NextResponse.json({ error: 'question_count must be between 1 and 30' }, { status: 400 })
  }

  const safeOptions = sanitizeOptions(options)
  await cleanupInactiveBattles(adminSupabase)

  const questions = generateTargetedQuestions(
    category,
    difficulty,
    question_count,
    safeOptions
  )

  const now = new Date().toISOString()

  const { data: battle, error } = await adminSupabase
    .from('battles')
    .insert({
      host_id:         user.id,
      guest_id:        null,
      mode:            'realtime',
      difficulty,
      question_count:  questions.length,
      time_per_q_secs: timeLimits[difficulty as Difficulty],
      status:          'active',
      started_at:      now,
    })
    .select()
    .single()

  if (error || !battle) {
    return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  }

  await adminSupabase
    .from('battle_questions')
    .insert(questions.map((q, i) => ({
      battle_id:      battle.id,
      sequence:       i + 1,
      question_text:  q.question_text,
      correct_answer: q.correct_answer,
      category:       q.category,
      difficulty:     q.difficulty,
      server_sent_at: now,
    })))

  return NextResponse.json({ session_id: battle.id })
}
