import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Play — Battle Lobby',
  description: 'Jump into a quick battle against real players, challenge a friend with an invite code, or warm up against an AI bot. Choose your difficulty and fight!',
  alternates:  { canonical: '/lobby' },
}

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
