'use client'

import { useEffect, useRef, useState } from 'react'

interface TimerProps {
  durationSecs: number
  serverSentAt: string | null
  onExpire:     () => void
  paused?:      boolean
}

export function Timer({ durationSecs, serverSentAt, onExpire, paused }: TimerProps) {
  const expiredRef  = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  const [remaining, setRemaining] = useState<number>(durationSecs)

  // Tick every 100ms
  useEffect(() => {
    // Reset expired flag when question changes
    expiredRef.current = false

    if (paused) return

    const interval = setInterval(() => {
      if (!serverSentAt) {
        setRemaining(durationSecs)
        return
      }

      const elapsed = (Date.now() - new Date(serverSentAt).getTime()) / 1000
      const left    = Math.max(0, durationSecs - elapsed)

      setRemaining(left)

      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpireRef.current()
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [durationSecs, serverSentAt, paused])

  const pct     = durationSecs > 0 ? remaining / durationSecs : 0
  const secs    = Math.ceil(remaining)
  const danger  = pct < 0.33
  const warning = pct < 0.6 && !danger
  const circumf = 2 * Math.PI * 40

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <circle
          cx="48" cy="48" r="40"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        <circle
          cx="48" cy="48" r="40"
          fill="none"
          stroke={danger ? '#ef4444' : warning ? '#f97316' : '#a855f7'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumf}
          strokeDashoffset={circumf * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`text-2xl font-bold z-10 transition-colors ${
        danger  ? 'text-red-400 animate-pulse' :
        warning ? 'text-orange-400' :
                  'text-white'
      }`}>
        {secs}
      </span>
    </div>
  )
}