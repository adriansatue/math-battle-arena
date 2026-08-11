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

function parseCardPayload(body: CardPayload) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const rarity = typeof body.rarity === 'string' ? body.rarity : ''
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : ''
  const dropWeight = typeof body.drop_weight === 'number' ? body.drop_weight : Number(body.drop_weight)
  const isActive = typeof body.is_active === 'boolean' ? body.is_active : true

  if (name.length < 1 || name.length > 80) return { error: 'Name must be 1-80 characters.' }
  if (description.length > 240) return { error: 'Description must be 240 characters or less.' }
  if (!RARITIES.includes(rarity as (typeof RARITIES)[number])) return { error: 'Invalid rarity.' }
  if (imageUrl.length > 500) return { error: 'Image URL is too long.' }
  if (!Number.isInteger(dropWeight) || dropWeight < 1 || dropWeight > 100) {
    return { error: 'Drop weight must be between 1 and 100.' }
  }

  return {
    card: {
      name,
      description,
      rarity,
      image_url: imageUrl,
      drop_weight: dropWeight,
      is_active: isActive,
    },
  }
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseCardPayload(await request.json().catch(() => ({})))
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reward_catalog')
    .insert(parsed.card)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ card: data }, { status: 201 })
}
