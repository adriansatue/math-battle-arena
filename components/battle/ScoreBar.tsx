'use client'

interface Player {
  userId:   string
  username: string
  score:    number
  streak:   number
  online:   boolean
}

interface ScoreBarProps {
  players:      Player[]
  currentUserId: string
}

export function ScoreBar({ players, currentUserId }: ScoreBarProps) {
  const maxScore = Math.max(...players.map(p => p.score), 1)

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
      <div className="space-y-3">
        {players.map(player => {
          const isMe = player.userId === currentUserId
          const pct  = Math.round((player.score / maxScore) * 100)

          return (
            <div key={player.userId}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isMe ? 'text-purple-300' : 'text-white'}`}>
                    {isMe ? '⚔️ You' : `🛡️ ${player.username}`}
                  </span>
                  {!player.online && (
                    <span className="text-xs text-red-400 animate-pulse">● disconnected</span>
                  )}
                  {player.streak >= 3 && (
                    <span className="text-xs bg-orange-500/30 text-orange-300 px-2 py-0.5 rounded-full">
                      🔥 {player.streak}x
                    </span>
                  )}
                </div>
                <span className="text-white font-bold">{player.score} pts</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isMe ? 'bg-purple-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}