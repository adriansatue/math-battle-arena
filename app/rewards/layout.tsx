import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Cards & Rewards',
  description: 'View your card collection, open reward packs and discover new cards earned from battles and practice sessions.',
  alternates:  { canonical: '/rewards' },
}

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
