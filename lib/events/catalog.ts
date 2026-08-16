export const SERVER_EVENT_NAMES = [
  'account_started',
  'guest_upgraded',
  'matchmaking_started',
  'match_found',
  'bot_fallback_started',
  'battle_started',
  'battle_finished',
  'practice_started',
  'practice_finished',
  'pack_opened',
  'daily_objective_claimed',
] as const

export const CLIENT_EVENT_NAMES = [
  'lobby_viewed',
  'results_viewed',
  'answer_review_opened',
  'play_again_clicked',
  'recommended_practice_clicked',
  'profile_insight_viewed',
  'daily_objectives_viewed',
  'weekly_summary_viewed',
] as const

export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number]
export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number]
export type EventProperty = string | number | boolean | null
export type EventProperties = Record<string, EventProperty>

const CLIENT_PROPERTY_KEYS: Record<ClientEventName, readonly string[]> = {
  lobby_viewed: ['has_profile'],
  results_viewed: ['mode', 'difficulty', 'opponent_type'],
  answer_review_opened: ['battle_id'],
  play_again_clicked: ['mode', 'difficulty'],
  recommended_practice_clicked: ['topic', 'source'],
  profile_insight_viewed: ['primary_topic', 'insight_status', 'sample_label'],
  daily_objectives_viewed: [],
  weekly_summary_viewed: ['division', 'has_personal_summary'],
}

export function isClientEventName(value: unknown): value is ClientEventName {
  return typeof value === 'string' && (CLIENT_EVENT_NAMES as readonly string[]).includes(value)
}

export function sanitizeClientProperties(
  eventName: ClientEventName,
  value: unknown
): EventProperties {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const input = value as Record<string, unknown>
  const allowedKeys = CLIENT_PROPERTY_KEYS[eventName]
  const result: EventProperties = {}

  for (const key of allowedKeys) {
    const property = input[key]
    if (
      property === null ||
      typeof property === 'boolean' ||
      (typeof property === 'number' && Number.isFinite(property)) ||
      (typeof property === 'string' && property.length <= 80)
    ) {
      result[key] = property
    }
  }

  return result
}