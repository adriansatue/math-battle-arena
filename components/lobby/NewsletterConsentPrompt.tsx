'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type PreferenceState = {
  newsletter_eligible: boolean
  newsletter_prompted_at: string | null
  newsletter_decided_at: string | null
}

export function NewsletterConsentPrompt() {
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recordedView = useRef(false)

  useEffect(() => {
    let active = true
    fetch('/api/email/preferences', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return null
        return response.json() as Promise<PreferenceState>
      })
      .then(preferences => {
        if (!active || !preferences?.newsletter_eligible || preferences.newsletter_decided_at) return
        setVisible(true)
        if (!preferences.newsletter_prompted_at && !recordedView.current) {
          recordedView.current = true
          void fetch('/api/email/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newsletter_prompted: true }),
          })
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function decide(newsletterOptIn: boolean) {
    setSaving(true)
    setError(null)
    const response = await fetch('/api/email/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newsletter_opt_in: newsletterOptIn,
        newsletter_source: 'lobby_prompt',
      }),
    })
    if (response.ok) {
      setVisible(false)
    } else {
      const result = await response.json().catch(() => ({})) as { code?: string }
      setError(result.code === 'NEWSLETTER_NOT_CONFIGURED'
        ? 'Email updates are not available yet. Please try again later.'
        : 'We could not save your choice. Please try again.')
    }
    setSaving(false)
  }

  if (!visible) return null

  return (
    <section aria-labelledby="newsletter-prompt-title" className="border border-cyan-300/25 bg-cyan-400/[0.08] px-4 py-4 shadow-lg shadow-cyan-950/15 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-cyan-200/25 bg-cyan-300/10 text-cyan-200" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="14" x="3" y="5" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200/70">Optional email</p>
          <h2 id="newsletter-prompt-title" className="mt-0.5 text-base font-black text-white">Keep up with the arena</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-purple-100/60">
            Get major game updates, new cards, seasons, and special events. No more than twice a month. Unsubscribe at any time.
          </p>
          <p className="mt-1 text-[11px] leading-4 text-purple-100/40">
            This is optional and does not affect your account. See our{' '}
            <Link href="/legal/data-protection" className="underline transition hover:text-white">privacy notice</Link>.
          </p>
          {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-200">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => decide(true)}
              className="min-h-10 bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Send me updates'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => decide(false)}
              className="min-h-10 border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
