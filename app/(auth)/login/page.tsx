'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login, sendMagicLink } from '@/lib/supabase/actions'
import { DemoButton } from '@/components/DemoButton'

type Mode = 'password' | 'magic'

export default function LoginPage() {
  const [mode, setMode]       = useState<Mode>('password')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/lobby'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    formData.set('next', next)
    const result   = mode === 'password' ? await login(formData) : await sendMagicLink(formData)

    if (result?.error) {
      setMessage({ type: 'error', text: result.error })
    } else if ('success' in result) {
      setMessage({ type: 'success', text: result.success })
    }
    setLoading(false)
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-2">Welcome back!</h2>
      <p className="text-purple-300 text-sm mb-6">Ready to battle?</p>

      {/* Mode toggle */}
      <div className="flex bg-white/5 rounded-xl p-1 mb-6 gap-1">
        <button
          onClick={() => setMode('password')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'password'
              ? 'bg-white/20 text-white shadow'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          🔑 Password
        </button>
        <button
          onClick={() => setMode('magic')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'magic'
              ? 'bg-white/20 text-white shadow'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          🪄 Magic Link
        </button>
      </div>

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

        {mode === 'password' && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-purple-200 text-sm font-medium">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-purple-400 hover:text-purple-200 transition">
                Forgot password?
              </Link>
            </div>
            <input
              name="password"
              type="password"
              required
              placeholder="Your password"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition"
            />
          </div>
        )}

        {mode === 'magic' && (
          <p className="text-purple-300 text-sm bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
            We&apos;ll send a one-click login link to your email. No password needed!
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 active:translate-y-0"
        >
          {loading
            ? 'Please wait...'
            : mode === 'password' ? 'Sign In ⚔️' : 'Send Magic Link 🪄'}
        </button>
      </form>

      <p className="text-center text-purple-300 text-sm mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-white font-semibold hover:text-purple-200 transition">
          Sign up free
        </Link>
      </p>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-transparent text-white/30 text-xs">or</span>
        </div>
      </div>

      <DemoButton
        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-semibold py-3 rounded-xl text-sm transition"
        label="👀 Try as Guest — no sign-up needed"
      />
    </div>
  )
}