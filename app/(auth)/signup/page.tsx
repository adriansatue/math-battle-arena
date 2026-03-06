'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signUp } from '@/lib/supabase/actions'

export default function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const result = await signUp(formData)

    if (result?.error)   setMessage({ type: 'error',   text: result.error })
    if (result?.success) setMessage({ type: 'success', text: result.success })
    setLoading(false)
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-2">Create account</h2>
      <p className="text-purple-300 text-sm mb-6">Join the arena and start battling!</p>

      {message && (
        <div className={`rounded-xl p-4 mb-6 text-sm font-medium ${
          message.type === 'error'
            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
            : 'bg-green-500/20 text-green-300 border border-green-500/30'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-purple-200 text-sm font-medium mb-1">
            Username
          </label>
          <input
            name="username"
            type="text"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            placeholder="mathwizard99"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition"
          />
          <p className="text-white/30 text-xs mt-1">Letters, numbers, underscores only</p>
        </div>

        <div>
          <label className="block text-purple-200 text-sm font-medium mb-1">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition"
          />
        </div>

        <div>
          <label className="block text-purple-200 text-sm font-medium mb-1">
            Password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Min. 8 characters"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0"
        >
          {loading ? 'Creating account...' : 'Create Account 🚀'}
        </button>
      </form>

      <p className="text-center text-purple-300 text-sm mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-white font-semibold hover:text-purple-200 transition">
          Sign in
        </Link>
      </p>
    </div>
  )
}