import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RewardsClient from './RewardsClient'

export const dynamic = 'force-dynamic'

type InventoryRow = {
  id:          string
  obtained_at: string
  grade?:       number | null
  reward_catalog: {
    id:          string
    name:        string
    description: string
    rarity:      'common' | 'uncommon' | 'rare' | 'legendary'
    image_url:   string
  }
}

export default async function RewardsPage() {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: inv, error: invError }, { count: totalCards }] = await Promise.all([
    admin
      .from('profiles')
      .select('total_points')
      .eq('id', user.id)
      .single(),
    admin
      .from('user_inventory')
      .select(`
        id,
        obtained_at,
        grade,
        reward_catalog (
          id, name, description, rarity, image_url
        )
      `)
      .eq('user_id', user.id)
      .order('obtained_at', { ascending: false }),
    admin
      .from('reward_catalog')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
  ])

  if (invError) console.error('[RewardsPage] inv error:', invError.message)

  return (
    <RewardsClient
      initialInventory={(inv as unknown as InventoryRow[]) ?? []}
      initialPoints={profile?.total_points ?? 0}
      totalCards={totalCards ?? 0}
    />
  )
}
