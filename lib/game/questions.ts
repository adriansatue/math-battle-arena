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

export interface PracticeOptions {
  timesTable?: number | number[]
  divisor?: number | number[]
  maxNumber?: number
}

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const pick = <T,>(items: T[]) => items[rand(0, items.length - 1)]

const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b)

function decimal(value: number) {
  return Math.round(value * 10_000) / 10_000
}

function uniqueQuestions(count: number, makeQuestion: () => Question): Question[] {
  const questions: Question[] = []
  const seen = new Set<string>()
  let attempts = 0

  while (questions.length < count && attempts < count * 60) {
    attempts++
    const question = makeQuestion()
    const canRepeat = attempts > count * 30

    if (canRepeat || !seen.has(question.question_text)) {
      seen.add(question.question_text)
      questions.push(question)
    }
  }

  while (questions.length < count) {
    questions.push(makeQuestion())
  }

  return questions
}

function makeAddition(difficulty: Difficulty): Question {
  const max =
    difficulty === 'easy' ? 60 :
    difficulty === 'medium' ? 250 :
    1_000
  const min = difficulty === 'hard' ? -150 : 1
  const a = rand(min, max)
  const b = rand(min, max)

  return {
    question_text: `${a} + ${b}`,
    correct_answer: a + b,
    category: 'addition',
    difficulty,
  }
}

function makeSubtraction(difficulty: Difficulty): Question {
  const max =
    difficulty === 'easy' ? 80 :
    difficulty === 'medium' ? 300 :
    1_000
  const a = rand(difficulty === 'hard' ? -100 : 10, max)
  const b = rand(difficulty === 'hard' ? -100 : 1, max)

  return {
    question_text: `${a} - ${b}`,
    correct_answer: a - b,
    category: 'subtraction',
    difficulty,
  }
}

function makeMultiplication(difficulty: Difficulty, fixedTable?: number): Question {
  const left = fixedTable ?? (
    difficulty === 'easy' ? rand(1, 10) :
    difficulty === 'medium' ? rand(2, 12) :
    rand(-15, 20)
  )
  const right =
    difficulty === 'easy' ? rand(1, 10) :
    difficulty === 'medium' ? rand(2, 12) :
    rand(-12, 20)

  return {
    question_text: `${left} x ${right}`,
    correct_answer: left * right,
    category: 'multiplication',
    difficulty,
  }
}

function makeDivision(difficulty: Difficulty, fixedDivisor?: number): Question {
  const divisor = fixedDivisor ?? (
    difficulty === 'easy' ? rand(1, 10) :
    difficulty === 'medium' ? rand(2, 12) :
    rand(2, 20)
  )
  const result =
    difficulty === 'easy' ? rand(1, 10) :
    difficulty === 'medium' ? rand(2, 15) :
    rand(-20, 30)
  const dividend = divisor * result

  return {
    question_text: `${dividend} / ${divisor}`,
    correct_answer: result,
    category: 'division',
    difficulty,
  }
}

function makeOrderOfOps(difficulty: Difficulty): Question {
  const a = rand(difficulty === 'hard' ? -12 : 2, difficulty === 'easy' ? 8 : 15)
  const b = rand(2, difficulty === 'easy' ? 8 : 15)
  const c = rand(2, difficulty === 'easy' ? 8 : 12)
  const pattern = pick(['grouped_multiply', 'multiply_add', 'multiply_subtract'])

  if (pattern === 'grouped_multiply') {
    return {
      question_text: `(${a} + ${b}) x ${c}`,
      correct_answer: (a + b) * c,
      category: 'order_of_ops',
      difficulty,
    }
  }

  if (pattern === 'multiply_add') {
    return {
      question_text: `${a} + ${b} x ${c}`,
      correct_answer: a + b * c,
      category: 'order_of_ops',
      difficulty,
    }
  }

  return {
    question_text: `${a} x ${b} - ${c}`,
    correct_answer: a * b - c,
    category: 'order_of_ops',
    difficulty,
  }
}

function makeFraction(difficulty: Difficulty): Question {
  const denominators =
    difficulty === 'easy' ? [2, 3, 4, 5] :
    difficulty === 'medium' ? [2, 3, 4, 5, 6, 8] :
    [2, 3, 4, 5, 6, 7, 8, 10, 12]
  const den1 = pick(denominators)
  const den2 = pick(denominators)
  const num1 = rand(1, den1 - 1)
  const num2 = rand(1, den2 - 1)
  const operator = difficulty === 'easy' ? '+' : pick(['+', '-'])
  const commonDen = den1 * den2
  const rawNum = operator === '+'
    ? num1 * den2 + num2 * den1
    : num1 * den2 - num2 * den1
  const divisor = gcd(rawNum, commonDen)

  return {
    question_text: `${num1}/${den1} ${operator} ${num2}/${den2}`,
    correct_answer: decimal((rawNum / divisor) / (commonDen / divisor)),
    category: 'fractions',
    difficulty,
  }
}

function makeQuestionForCategory(category: Category, difficulty: Difficulty, options: PracticeOptions = {}): Question {
  if (category === 'addition') return makeAddition(difficulty)
  if (category === 'subtraction') return makeSubtraction(difficulty)

  if (category === 'multiplication') {
    const tableOpt = options.timesTable
    const tablePool = Array.isArray(tableOpt) ? tableOpt : tableOpt ? [tableOpt] : null
    return makeMultiplication(difficulty, tablePool ? pick(tablePool) : undefined)
  }

  if (category === 'division') {
    const divisorOpt = options.divisor
    const divisorPool = Array.isArray(divisorOpt) ? divisorOpt : divisorOpt ? [divisorOpt] : null
    return makeDivision(difficulty, divisorPool ? pick(divisorPool) : undefined)
  }

  if (category === 'fractions') return makeFraction(difficulty)
  return makeOrderOfOps(difficulty)
}

export function generateQuestions(
  difficulty: Difficulty,
  count: number
): Question[] {
  const pools: Record<Difficulty, Category[]> = {
    easy:   ['addition', 'subtraction', 'multiplication', 'division'],
    medium: ['addition', 'subtraction', 'multiplication', 'division', 'order_of_ops', 'fractions'],
    hard:   ['addition', 'subtraction', 'multiplication', 'division', 'order_of_ops', 'fractions'],
  }

  return uniqueQuestions(count, () => makeQuestionForCategory(pick(pools[difficulty]), difficulty))
}

export const timeLimits: Record<Difficulty, number> = {
  easy:   25,
  medium: 15,
  hard:   6,
}

export function generateTargetedQuestions(
  category: Category,
  difficulty: Difficulty,
  count: number,
  options: PracticeOptions = {}
): Question[] {
  const safeOptions: PracticeOptions = { ...options }

  if (category === 'addition' || category === 'subtraction') {
    const max = safeOptions.maxNumber
    if (typeof max === 'number' && Number.isFinite(max)) {
      safeOptions.maxNumber = Math.max(10, Math.min(Math.floor(max), 1_000))
    }
  }

  return uniqueQuestions(count, () => {
    if (category === 'addition' && safeOptions.maxNumber) {
      const a = rand(1, safeOptions.maxNumber)
      const b = rand(1, safeOptions.maxNumber)
      return {
        question_text: `${a} + ${b}`,
        correct_answer: a + b,
        category,
        difficulty,
      }
    }

    if (category === 'subtraction' && safeOptions.maxNumber) {
      const a = rand(1, safeOptions.maxNumber)
      const b = rand(1, safeOptions.maxNumber)
      return {
        question_text: `${a} - ${b}`,
        correct_answer: a - b,
        category,
        difficulty,
      }
    }

    return makeQuestionForCategory(category, difficulty, safeOptions)
  })
}

export function generateQuestionsForCategory(
  category: Category,
  difficulty: Difficulty,
  count: number
): Question[] {
  return generateTargetedQuestions(category, difficulty, count)
}

export function generateWrongAnswers(correct: number, count: number = 3): number[] {
  const wrong = new Set<number>()
  const offsets = [1, 2, 3, 5, 8, 10, 12, 15]

  let attempts = 0
  while (wrong.size < count && attempts < 100) {
    attempts++
    const candidate = correct + pick(offsets) * (Math.random() > 0.5 ? 1 : -1)
    if (candidate !== correct && !wrong.has(candidate)) {
      wrong.add(decimal(candidate))
    }
  }

  let fallback = correct - count
  while (wrong.size < count) {
    if (fallback !== correct) wrong.add(decimal(fallback))
    fallback++
  }

  return Array.from(wrong)
}
