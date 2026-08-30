import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bot Campaign',
  description: 'Challenge twenty progressively harder AI rivals and climb the Math Battle Arena bot campaign.',
  alternates: { canonical: '/bot-campaign' },
}

export default function BotCampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}