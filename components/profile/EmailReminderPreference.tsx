'use client'

import { useEffect, useState } from 'react'

export function EmailReminderPreference() {
  const [preferences, setPreferences] = useState({
    reengagement_opt_in: false,
    newsletter_opt_in: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/email/preferences', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load preference')
        const data = await response.json() as typeof preferences
        if (active) setPreferences(data)
      })
      .catch(() => { if (active) setError('Email preference is temporarily unavailable.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function updatePreference(key: keyof typeof preferences, nextValue: boolean) {
    setSaving(true)
    setError(null)
    const response = await fetch('/api/email/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: nextValue }),
    })
    if (response.ok) setPreferences(current => ({ ...current, [key]: nextValue }))
    else setError('Could not update your email preference.')
    setSaving(false)
  }

  const options = [
    {
      key: 'reengagement_opt_in' as const,
      label: 'Occasional game reminders',
      description: 'Receive an email after a quiet week. At most one every 30 days.',
    },
    {
      key: 'newsletter_opt_in' as const,
      label: 'Game updates newsletter',
      description: 'Major features, new cards, seasons, and special events. No more than twice a month.',
    },
  ]

  return <div className="divide-y divide-white/10">
    {options.map(option => {
      const enabled = preferences[option.key]
      return <div key={option.key} className="flex items-start justify-between gap-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white/80">{option.label}</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-purple-200/45">{option.description} Unsubscribe any time.</p>
          {error && <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={option.label}
          disabled={loading || saving}
          onClick={() => updatePreference(option.key, !enabled)}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full border transition ${enabled ? 'border-emerald-300/60 bg-emerald-400/50' : 'border-white/15 bg-white/10'} disabled:opacity-40`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
    })}
  </div>
}
