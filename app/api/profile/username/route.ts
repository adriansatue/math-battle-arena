import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { escapeLikePattern, isUsernameConflict } from '@/lib/supabase/usernames'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/
const GENERATED_USERNAME_PATTERN =
  /^(Swift|Brave|Clever|Quick|Bright|Wild|Sharp|Bold|Calm|Cool)(Wizard|Knight|Hero|Ninja|Tiger|Eagle|Fox|Star|Wolf|Lion)\d{1,4}$/

function isGeneratedUsername(username: string | null | undefined) {
  if (!username) return true
  if (GENERATED_USERNAME_PATTERN.test(username)) return true
  return /^Player[_-]?[a-zA-Z0-9]{3,}$/i.test(username) || /^Guest[_-]?[a-zA-Z0-9]{3,}$/i.test(username)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { username?: string }
  const username = body.username?.trim() ?? ''

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({
      error: 'Username must be 3-20 characters and contain only letters, numbers, or underscores.',
    }, { status: 400 })
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, username, username_customized')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (profile.username_customized || !isGeneratedUsername(profile.username)) {
    return NextResponse.json({
      error: 'This username can only be changed while it is still the generated starter name.',
    }, { status: 403 })
  }

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', escapeLikePattern(username))
    .neq('id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Username is already taken. Try another one.' }, { status: 409 })
  }

  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update({
      username,
      username_customized: true,
    })
    .eq('id', user.id)
    .select('username, username_customized')
    .single()

  if (updateError || !updated) {
    if (isUsernameConflict(updateError)) {
      return NextResponse.json({ error: 'Username is already taken. Try another one.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not update username. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({
    username:            updated.username,
    username_customized: updated.username_customized,
  })
}
