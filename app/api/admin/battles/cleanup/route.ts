import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/admin-guard'
import { cleanupInactiveBattles } from '@/lib/game/battle-cleanup'

export async function POST() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const result = await cleanupInactiveBattles(admin)

  return NextResponse.json({
    success: true,
    ...result,
  })
}
