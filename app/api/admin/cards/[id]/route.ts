import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/admin-guard'

const RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const

type CardPayload = {
  name?: unknown
  description?: unknown
  rarity?: unknown
  image_url?: unknown
  drop_weight?: unknown
  is_active?: unknown
}

function parseCardPatch(body: CardPayload) {
  const patch: Record<string, string | number | boolean> = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return { error: 'Invalid name.' }
    const name = body.name.trim()
    if (name.length < 1 || name.length > 80) return { error: 'Name must be 1-80 characters.' }
    patch.name = name
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') return { error: 'Invalid description.' }
    const description = body.description.trim()
    if (description.length > 240) return { error: 'Description must be 240 characters or less.' }
    patch.description = description
  }

  if (body.rarity !== undefined) {
    if (typeof body.rarity !== 'string' || !RARITIES.includes(body.rarity as (typeof RARITIES)[number])) {
      return { error: 'Invalid rarity.' }
    }
    patch.rarity = body.rarity
  }

  if (body.image_url !== undefined) {
    if (typeof body.image_url !== 'string') return { error: 'Invalid image URL.' }
    const imageUrl = body.image_url.trim()
    if (imageUrl.length > 500) return { error: 'Image URL is too long.' }
    patch.image_url = imageUrl
  }

  if (body.drop_weight !== undefined) {
    const dropWeight = typeof body.drop_weight === 'number' ? body.drop_weight : Number(body.drop_weight)
    if (!Number.isInteger(dropWeight) || dropWeight < 1 || dropWeight > 100) {
      return { error: 'Drop weight must be between 1 and 100.' }
    }
    patch.drop_weight = dropWeight
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') return { error: 'Invalid active status.' }
    patch.is_active = body.is_active
  }

  if (Object.keys(patch).length === 0) return { error: 'No valid fields to update.' }
  return { patch }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = parseCardPatch(await request.json().catch(() => ({})))
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reward_catalog')
    .update(parsed.patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ card: data })
}
