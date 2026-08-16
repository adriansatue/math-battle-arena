'use client'

import type { ClientEventName, EventProperties } from './catalog'

const SESSION_ID_KEY = 'math-battle-session-id'

function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_ID_KEY)
  if (existing) return existing

  const sessionId = crypto.randomUUID()
  sessionStorage.setItem(SESSION_ID_KEY, sessionId)
  return sessionId
}

export async function recordClientEvent(
  eventName: ClientEventName,
  dedupKey?: string,
  properties: EventProperties = {},
  battleId?: string
) {
  try {
    const sessionId = getSessionId()
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        session_id: sessionId,
        battle_id: battleId,
        dedup_key: dedupKey ?? `session:${sessionId}`,
        properties,
      }),
      keepalive: true,
    })
  } catch {
    // Product measurement must never block gameplay.
  }
}