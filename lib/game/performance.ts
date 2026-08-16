export type TopicPerformance = {
  category: string
  accuracy_rate: number
  total_attempts: number
  avg_speed_ms: number
}

export type TopicInsight = {
  accuracyPercent: number
  status: 'focus' | 'developing' | 'strong'
  statusLabel: string
  observation: string
  recommendation: string
  sampleLabel: string
}

export function getTopicInsight(performance: TopicPerformance): TopicInsight {
  const accuracyPercent = Math.max(0, Math.min(100, Math.round(performance.accuracy_rate * 100)))
  const sampleLabel = performance.total_attempts < 10
    ? 'Early signal'
    : performance.total_attempts < 25
      ? 'Growing evidence'
      : 'Reliable pattern'

  if (accuracyPercent < 60) {
    return {
      accuracyPercent,
      status: 'focus',
      statusLabel: 'Focus next',
      observation: `You miss about ${100 - accuracyPercent} in every 100 answers in this topic.`,
      recommendation: 'Slow the pace, use Easy mode, and aim for 10 correct answers in a row.',
      sampleLabel,
    }
  }

  if (accuracyPercent < 80) {
    return {
      accuracyPercent,
      status: 'developing',
      statusLabel: 'Build consistency',
      observation: 'You understand the topic, but accuracy is not consistent yet.',
      recommendation: 'Practise a short focused set before increasing the speed.',
      sampleLabel,
    }
  }

  return {
    accuracyPercent,
    status: 'strong',
    statusLabel: 'Strong topic',
    observation: 'Your answers are consistently accurate in this topic.',
    recommendation: 'Try a faster difficulty or focus on a weaker topic.',
    sampleLabel,
  }
}