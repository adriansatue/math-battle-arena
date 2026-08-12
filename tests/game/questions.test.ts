import { describe, expect, it } from 'vitest'
import { generateQuestions, generateTargetedQuestions, generateWrongAnswers } from '@/lib/game/questions'

describe('question generation', () => {
  it('returns the requested number of mixed battle questions', () => {
    expect(generateQuestions('hard', 50)).toHaveLength(50)
  })

  it('returns the requested number of targeted practice questions', () => {
    expect(generateTargetedQuestions('multiplication', 'medium', 30, { timesTable: 7 })).toHaveLength(30)
  })

  it('can generate wrong answers for negative correct answers', () => {
    const wrong = generateWrongAnswers(-12, 3)

    expect(wrong).toHaveLength(3)
    expect(wrong).not.toContain(-12)
  })
})
