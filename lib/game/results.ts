export type ResultReviewItem = {
  category: string
  isCorrect: boolean
}

export type ResultRecommendation = {
  topic: string | null
  correct: number
  total: number
  kind: 'focus' | 'challenge'
}

export function getResultRecommendation(items: ResultReviewItem[]): ResultRecommendation | null {
  if (items.length === 0) return null

  const byTopic = new Map<string, { correct: number; total: number }>()
  for (const item of items) {
    const current = byTopic.get(item.category) ?? { correct: 0, total: 0 }
    current.total += 1
    if (item.isCorrect) current.correct += 1
    byTopic.set(item.category, current)
  }

  const weakest = [...byTopic.entries()].sort((left, right) => {
    const leftAccuracy = left[1].correct / left[1].total
    const rightAccuracy = right[1].correct / right[1].total
    return leftAccuracy - rightAccuracy || right[1].total - left[1].total || left[0].localeCompare(right[0])
  })[0]

  if (!weakest) return null
  const [topic, performance] = weakest
  const allCorrect = items.every(item => item.isCorrect)

  return {
    topic,
    correct: performance.correct,
    total: performance.total,
    kind: allCorrect ? 'challenge' : 'focus',
  }
}