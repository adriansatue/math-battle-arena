'use client'

import { useState } from 'react'

export function UnsubscribeButton({ token }: { token: string }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  async function unsubscribe() {
    setStatus('saving')
    const response = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'POST' })
    const data = await response.json().catch(() => ({})) as { unsubscribed?: boolean }
    setStatus(response.ok && data.unsubscribed ? 'done' : 'error')
  }

  if (status === 'done') return <p className="mt-6 font-bold text-emerald-300">Email reminders stopped.</p>

  return (
    <div className="mt-6">
      <button type="button" onClick={unsubscribe} disabled={status === 'saving'} className="bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
        {status === 'saving' ? 'Updating' : 'Stop email reminders'}
      </button>
      {status === 'error' && <p role="alert" className="mt-3 text-sm text-red-300">This unsubscribe link is invalid or unavailable.</p>}
    </div>
  )
}
