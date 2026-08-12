import type { ReactNode } from 'react'

type GameNoticeKind = 'info' | 'warning' | 'error'

interface GameNoticeProps {
  kind?: GameNoticeKind
  children: ReactNode
}

const styles: Record<GameNoticeKind, string> = {
  info:    'bg-blue-500/15 border-blue-400/30 text-blue-100',
  warning: 'bg-yellow-500/15 border-yellow-400/35 text-yellow-100',
  error:   'bg-red-500/15 border-red-400/35 text-red-100',
}

export function GameNotice({ kind = 'info', children }: GameNoticeProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold leading-snug ${styles[kind]}`}>
      {children}
    </div>
  )
}
