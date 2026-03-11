import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:  'Sign In',
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            ⚔️ Math Battle
          </h1>
          <p className="text-purple-300 mt-2 text-sm">
            Arena — Sharpen your mind, battle your rivals
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}