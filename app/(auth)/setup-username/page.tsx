'use client'

import { useState } from 'react'
import { saveUsername } from '@/lib/supabase/actions'

export default function SetupUsernamePage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result   = await saveUsername(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, saveUsername redirects to /lobby — no need to do anything here
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-2">One last step!</h2>
      <p className="text-purple-300 text-sm mb-6">Choose a username to show on the leaderboard and in battles.</p>

      {error && (
        <div className="rounded-xl p-4 mb-6 text-sm font-medium bg-red-500/20 text-red-300 border border-red-500/30">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-purple-200 text-sm font-medium mb-1">Username</label>
          <input
            name="username"
            type="text"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            placeholder="mathwizard99"
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition"
          />
          <p className="text-white/30 text-xs mt-1">Letters, numbers, underscores only (3–20 chars)</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0"
        >
          {loading ? 'Saving...' : 'Enter the Arena ⚔️'}
        </button>
      </form>
    </div>
  )
}
