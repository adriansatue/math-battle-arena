import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Leaderboard — Top Math Champions',
  description: 'See who\'s topping the Math Battle Arena rankings. Compete in battles, earn points and climb the leaderboard to claim the crown 👑',
  alternates:  { canonical: '/leaderboard' },
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
