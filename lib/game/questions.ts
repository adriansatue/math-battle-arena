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

// ── TARGETED GENERATORS ───────────────────────

export interface PracticeOptions {
  timesTable?: number | number[]   // one or more times tables e.g. [3, 7, 9]
  divisor?:   number | number[]   // one or more divisors e.g. [4, 6]
  maxNumber?: number              // max number for add/subtract e.g. 100
}

export function generateTargetedQuestions(
  category:   Category,
  difficulty: Difficulty,
  count:      number,
  options:    PracticeOptions = {}
): Question[] {
  const questions: Question[] = []
  const seen = new Set<string>()
  let attempts = 0

  while (questions.length < count && attempts < count * 30) {
    attempts++
    let q: Question | null = null

    if (category === 'multiplication') {
      const tableOpt = options.timesTable
      const tablePool = Array.isArray(tableOpt) ? tableOpt : tableOpt ? [tableOpt] : null
      const table = tablePool ? tablePool[rand(0, tablePool.length - 1)] : rand(2, 12)
      const other = difficulty === 'hard' ? rand(2, 12) : rand(1, 12)
      q = {
        question_text:  `${table} × ${other}`,
        correct_answer: table * other,
        category:       'multiplication',
        difficulty,
      }
    }

    else if (category === 'division') {
      const divisorOpt  = options.divisor
      const divisorPool = Array.isArray(divisorOpt) ? divisorOpt : divisorOpt ? [divisorOpt] : null
      const divisor  = divisorPool ? divisorPool[rand(0, divisorPool.length - 1)] : rand(2, 12)
      const result   = rand(1, 12)
      const dividend = divisor * result
      q = {
        question_text:  `${dividend} ÷ ${divisor}`,
        correct_answer: result,
        category:       'division',
        difficulty,
      }
    }

    else if (category === 'addition') {
      const max = options.maxNumber ?? 100
      const a   = rand(1, max - 1)
      const b   = rand(1, max - a)
      q = {
        question_text:  `${a} + ${b}`,
        correct_answer: a + b,
        category:       'addition',
        difficulty,
      }
    }

    else if (category === 'subtraction') {
      const max = options.maxNumber ?? 100
      const a   = rand(2, max)
      const b   = rand(1, a)
      q = {
        question_text:  `${a} - ${b}`,
        correct_answer: a - b,
        category:       'subtraction',
        difficulty,
      }
    }

    else if (category === 'fractions') {
      q = makeFraction()
    }

    else if (category === 'order_of_ops') {
      q = makeOrderOfOps()
    }

    if (q && !seen.has(q.question_text)) {
      seen.add(q.question_text)
      questions.push({ ...q, difficulty })
    }
  }

  return questions
}
// Generate questions for a specific category
export function generateQuestionsForCategory(
  category: Category,
  difficulty: Difficulty,
  count: number
): Question[] {
  const generatorMap: Record<Category, (() => Question)[]> = {
    addition:       [makeAddition],
    subtraction:    [makeSubtraction],
    multiplication: difficulty === 'hard'
      ? [makeNegativeMultiplication]
      : [makeMultiplication],
    division:       [makeDivision],
    fractions:      [makeFraction],
    order_of_ops:   [makeOrderOfOps],
  }

  const generators = generatorMap[category] ?? [makeAddition]
  const questions: Question[] = []
  const seen = new Set<string>()
  let attempts = 0

  while (questions.length < count && attempts < count * 20) {
    attempts++
    const gen = generators[rand(0, generators.length - 1)]
    const q   = gen()
    if (!seen.has(q.question_text)) {
      seen.add(q.question_text)
      questions.push({ ...q, difficulty })
    }
  }

  return questions
}

export function generateWrongAnswers(correct: number, count: number = 3): number[] {
  const wrong = new Set<number>()
  const ranges = [1, 2, 3, 5, 8, 10]

  let attempts = 0
  while (wrong.size < count && attempts < 100) {
    attempts++
    const offset = ranges[Math.floor(Math.random() * ranges.length)]
    const sign   = Math.random() > 0.5 ? 1 : -1
    const candidate = correct + sign * offset

    // Keep answers positive and not equal to correct
    if (candidate !== correct && candidate > 0 && !wrong.has(candidate)) {
      wrong.add(candidate)
    }
  }

  // Fallback if not enough
  let fallback = 1
  while (wrong.size < count) {
    if (fallback !== correct && !wrong.has(fallback)) wrong.add(fallback)
    fallback++
  }

  return Array.from(wrong)
}