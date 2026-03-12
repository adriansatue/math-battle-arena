'use client'

import { useState } from 'react'

interface DemoButtonProps {
  className?: string
  label?: string
}

export function DemoButton({ className, label = '👀 Try as Guest' }: DemoButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function startDemo() {
    setLoading(true)
    setError(null)

    // The server creates the anonymous session and sets auth cookies on the response.
    // This avoids client-side cookie propagation issues.
    const res = await fetch('/api/auth/demo', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(
        body.error === 'Anonymous sign-in not available'
          ? 'Guest mode is not available right now. Please sign up — it\'s free!'
          : 'Could not set up guest account. Please try again.'
      )
      setLoading(false)
      return
    }

    // Hard redirect so the browser fully processes the Set-Cookie headers
    // before any server-side auth check in the next request
    window.location.href = '/practice'
  }

  return (
    <div className="w-full">
      <button
        onClick={startDemo}
        disabled={loading}
        className={className}
      >
        {loading ? '⏳ Setting up...' : label}
      </button>
      {error && (
        <p className="text-red-400 text-xs text-center mt-2">{error}</p>
      )}
    </div>
  )
}
