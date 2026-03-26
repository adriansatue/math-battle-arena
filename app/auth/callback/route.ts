import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
