'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login, sendMagicLink, signInWithGoogle } from '@/lib/supabase/actions'
import { DemoButton } from '@/components/DemoButton'

type Mode = 'password' | 'magic'

function LoginForm() {
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

      <button
        onClick={() => signInWithGoogle()}
        className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 hover:bg-gray-100 font-semibold py-3 rounded-xl text-sm transition shadow-sm mb-3"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <DemoButton
        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-semibold py-3 rounded-xl text-sm transition"
        label="👀 Try as Guest — no sign-up needed"
      />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}