import { createAdminClient } from '@/lib/supabase/admin'
import { isUniqueViolation } from '@/lib/supabase/errors'
import type { EventProperties, ServerEventName } from './catalog'

type RecordServerEventInput = {
  userId: string
  eventName: ServerEventName
  dedupKey: string
  sessionId?: string | null
  battleId?: string | null
  properties?: EventProperties
}

export async function recordServerEvent(input: RecordServerEventInput) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('product_events').insert({
      user_id:     input.userId,
      event_name:  input.eventName,
      source:      'server',
      session_id:  input.sessionId ?? null,
      battle_id:   input.battleId ?? null,
      dedup_key:   input.dedupKey.slice(0, 160),
      properties:  input.properties ?? {},
      occurred_at: new Date().toISOString(),
    })

    if (error && !isUniqueViolation(error)) {
      console.error(`[events] Could not record ${input.eventName}:`, error.message)
    }
  } catch (error) {
    console.error(`[events] Could not record ${input.eventName}:`, error)
  }
}