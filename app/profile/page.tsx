'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProfileRedirect() {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push(`/profile/${user.id}`)
      else      router.push('/login')
    })
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center">
      <div className="text-white animate-pulse">Loading...</div>
    </div>
  )
}