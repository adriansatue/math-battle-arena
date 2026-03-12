import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

const ADJECTIVES = ['Swift', 'Brave', 'Clever', 'Quick', 'Bright', 'Wild', 'Sharp', 'Bold', 'Calm', 'Cool']
const NOUNS      = ['Wizard', 'Knight', 'Hero', 'Ninja', 'Tiger', 'Eagle', 'Fox', 'Star', 'Wolf', 'Lion']

function randomUsername() {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num  = Math.floor(Math.random() * 999) + 1
  return `${adj}${noun}${num}`
}

export async function POST() {
  const cookieStore = await cookies()

  // Collect cookies the auth SDK wants to set, then apply them to the response
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()           { return cookieStore.getAll() },
        setAll(items)      { pendingCookies.push(...items) },
      },
    }
  )

  // Create the anonymous session server-side — cookies are returned in the response
  const { data: { user }, error } = await supabase.auth.signInAnonymously()
  if (error || !user) {
    return NextResponse.json({ error: 'Anonymous sign-in not available' }, { status: 503 })
  }

  const admin = createAdminClient()

  // Idempotent — skip if profile already exists (e.g. page refresh)
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!existing) {
    // Generate a unique guest username; retry once on collision
    let username = randomUsername()
    const { data: taken } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()
    if (taken) username = randomUsername() + Math.floor(Math.random() * 9)

    await admin.from('profiles').insert({
      id:           user.id,
      username,
      total_points: 0,
      level:        1,
      rank_title:   'Math Rookie',
      wins:         0,
      losses:       0,
      best_streak:  0,
    })
  }

  const response = NextResponse.json({ ok: true })

  // Apply the session cookies to the response so the browser stores them
  pendingCookies.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.cookies.set(name, value, options as any)
  })

  return response
}
