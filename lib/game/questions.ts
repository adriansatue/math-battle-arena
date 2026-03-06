export type Category =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'fractions'
  | 'order_of_ops'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Question {
  question_text: string
  correct_answer: number
  category: Category
  difficulty: Difficulty
}

// ── RANDOM HELPERS ────────────────────────────
const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const fraction = (num: number, den: number) => ({ num, den })
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
const simplify = (num: number, den: number) => {
  const g = gcd(Math.abs(num), Math.abs(den))
  return { num: num / g, den: den / g }
}

// ── GENERATORS PER CATEGORY ───────────────────
function makeAddition(): Question {
  const a = rand(10, 99)
  const b = rand(10, 99)
  return {
    question_text: `${a} + ${b}`,
    correct_answer: a + b,
    category: 'addition',
    difficulty: 'easy',
  }
}

function makeSubtraction(): Question {
  const a = rand(20, 99)
  const b = rand(1, a)
  return {
    question_text: `${a} - ${b}`,
    correct_answer: a - b,
    category: 'subtraction',
    difficulty: 'easy',
  }
}

function makeMultiplication(): Question {
  const a = rand(2, 12)
  const b = rand(2, 12)
  return {
    question_text: `${a} × ${b}`,
    correct_answer: a * b,
    category: 'multiplication',
    difficulty: 'medium',
  }
}

function makeDivision(): Question {
  const b = rand(2, 12)
  const result = rand(2, 12)
  const a = b * result // guarantees whole number
  return {
    question_text: `${a} ÷ ${b}`,
    correct_answer: result,
    category: 'division',
    difficulty: 'medium',
  }
}

function makeOrderOfOps(): Question {
  const a = rand(2, 9)
  const b = rand(2, 9)
  const c = rand(2, 9)
  const answer = (a + b) * c
  return {
    question_text: `(${a} + ${b}) × ${c}`,
    correct_answer: answer,
    category: 'order_of_ops',
    difficulty: 'medium',
  }
}

function makeFraction(): Question {
  // Only use denominators 2, 3, 4, 5 for child-friendliness
  const denominators = [2, 3, 4, 5]
  const den1 = denominators[rand(0, 3)]
  const den2 = denominators[rand(0, 3)]
  const num1 = rand(1, den1 - 1)
  const num2 = rand(1, den2 - 1)

  // Add fractions: num1/den1 + num2/den2
  const resultNum = num1 * den2 + num2 * den1
  const resultDen = den1 * den2
  const simplified = simplify(resultNum, resultDen)

  // Format answer as decimal rounded to 4 places
  const answer = Math.round((simplified.num / simplified.den) * 10000) / 10000

  return {
    question_text: `${num1}/${den1} + ${num2}/${den2}`,
    correct_answer: answer,
    category: 'fractions',
    difficulty: 'hard',
  }
}

function makeNegativeMultiplication(): Question {
  const a = rand(2, 12)
  const b = rand(2, 12)
  const negative = Math.random() > 0.5 ? -a : a
  return {
    question_text: `${negative} × ${b}`,
    correct_answer: negative * b,
    category: 'multiplication',
    difficulty: 'hard',
  }
}

// ── DIFFICULTY POOLS ──────────────────────────
const easyGenerators   = [makeAddition, makeSubtraction]
const mediumGenerators = [makeMultiplication, makeDivision, makeOrderOfOps]
const hardGenerators   = [makeFraction, makeNegativeMultiplication, makeOrderOfOps]

// ── MAIN GENERATOR ────────────────────────────
export function generateQuestions(
  difficulty: Difficulty,
  count: number
): Question[] {
  const generators =
    difficulty === 'easy'   ? easyGenerators   :
    difficulty === 'medium' ? mediumGenerators :
                              hardGenerators

  const questions: Question[] = []
  const seen = new Set<string>()

  let attempts = 0
  while (questions.length < count && attempts < count * 10) {
    attempts++
    const gen = generators[rand(0, generators.length - 1)]
    const q = gen()
    const key = q.question_text

    if (!seen.has(key)) {
      seen.add(key)
      questions.push({ ...q, difficulty })
    }
  }

  return questions
}

// ── TIME LIMITS PER DIFFICULTY ─────────────────
export const timeLimits: Record<Difficulty, number> = {
  easy:   15,
  medium: 10,
  hard:   6,
}