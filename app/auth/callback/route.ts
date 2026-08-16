import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordServerEvent } from '@/lib/events/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/lobby'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // For OAuth users, check if they have a username set yet
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = createAdminClient()
        const { data: anonymousStart } = await admin
          .from('product_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('event_name', 'account_started')
          .eq('properties->>account_type', 'anonymous')
          .limit(1)
          .maybeSingle()

        if (anonymousStart) {
          await recordServerEvent({
            userId: user.id,
            eventName: 'guest_upgraded',
            dedupKey: `account:${user.id}:upgraded`,
            properties: { auth_method: 'google' },
          })
        } else {
          await recordServerEvent({
            userId: user.id,
            eventName: 'account_started',
            dedupKey: `account:${user.id}`,
            properties: { account_type: 'registered', auth_method: 'oauth' },
          })
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()
        if (!profile?.username) {
          return NextResponse.redirect(`${origin}/setup-username`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If something went wrong, send to login with an error
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}
