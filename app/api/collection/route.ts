import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PACKS, type PackType } from '@/lib/game/collection'

function isPackType(value: unknown): value is PackType {
  return typeof value === 'string' && value in PACKS
}

async function authenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await createAdminClient().rpc('get_collection_progress_v2', { p_user_id: user.id })
  if (error) return NextResponse.json({ error: 'Could not load collection progress' }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const packType = body.pack_type
  const showcaseId = body.showcased_inventory_id
  if (packType !== undefined && !isPackType(packType)) {
    return NextResponse.json({ error: 'Invalid pack type' }, { status: 400 })
  }
  if (showcaseId !== undefined && typeof showcaseId !== 'string') {
    return NextResponse.json({ error: 'Invalid showcase card' }, { status: 400 })
  }
  if (packType === undefined && showcaseId === undefined) {
    return NextResponse.json({ error: 'No preference supplied' }, { status: 400 })
  }

  const { error } = await createAdminClient().rpc('set_collection_preference', {
    p_user_id: user.id,
    p_pack_type: packType ?? null,
    p_showcased_inventory_id: showcaseId ?? null,
  })
  if (error) return NextResponse.json({ error: 'Could not update collection preference' }, { status: 409 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { set_key?: unknown }
  if (typeof body.set_key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(body.set_key)) {
    return NextResponse.json({ error: 'Invalid set' }, { status: 400 })
  }
  const { data, error } = await createAdminClient().rpc('claim_collection_set_reward_v2', {
    p_user_id: user.id,
    p_set_key: body.set_key,
  })
  if (error) return NextResponse.json({ error: 'Set is incomplete or already claimed' }, { status: 409 })
  return NextResponse.json({ claim: data })
}
