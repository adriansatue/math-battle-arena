import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUniqueViolation } from '@/lib/supabase/errors'
import { isClientEventName, sanitizeClientProperties } from '@/lib/events/catalog'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DEDUP_KEY_PATTERN = /^[a-zA-Z0-9:_-]{1,160}$/

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const eventName = body.event_name
  const sessionId = body.session_id
  const battleId = body.battle_id
  const dedupKey = body.dedup_key

  if (!isClientEventName(eventName)) {
    return NextResponse.json({ error: 'Unsupported event' }, { status: 400 })
  }

  if (typeof sessionId !== 'string' || !UUID_PATTERN.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
  }

  if (typeof dedupKey !== 'string' || !DEDUP_KEY_PATTERN.test(dedupKey)) {
    return NextResponse.json({ error: 'Invalid deduplication key' }, { status: 400 })
  }

  if (battleId !== undefined && (typeof battleId !== 'string' || !UUID_PATTERN.test(battleId))) {
    return NextResponse.json({ error: 'Invalid battle ID' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('product_events').insert({
    user_id:     user.id,
    event_name:  eventName,
    source:      'client',
    session_id:  sessionId,
    battle_id:   battleId ?? null,
    dedup_key:   dedupKey,
    properties:  sanitizeClientProperties(eventName, body.properties),
    occurred_at: new Date().toISOString(),
  })

  if (error && !isUniqueViolation(error)) {
    console.error(`[events] Could not record ${eventName}:`, error.message)
  }

  return new NextResponse(null, { status: 204 })
}