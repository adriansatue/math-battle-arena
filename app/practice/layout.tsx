import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Practice — Solo Maths Drills',
  description: 'Sharpen your multiplication and division skills with customisable solo practice sessions. Choose your times tables, set the number of questions, and go!',
  alternates:  { canonical: '/practice' },
}

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
