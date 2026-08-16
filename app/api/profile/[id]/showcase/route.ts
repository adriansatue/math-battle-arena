import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid player' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: preference } = await admin
    .from('collection_preferences')
    .select('showcased_inventory_id')
    .eq('user_id', id)
    .maybeSingle()

  if (!preference?.showcased_inventory_id) return NextResponse.json({ showcase: null })

  const { data: item } = await admin
    .from('user_inventory')
    .select('id, grade, reward_catalog(name, rarity, image_url)')
    .eq('id', preference.showcased_inventory_id)
    .eq('user_id', id)
    .maybeSingle()

  return NextResponse.json({ showcase: item ?? null })
}
