'use client'

import { useState } from 'react'

export default function TestPage() {
  const [battleId, setBattleId] = useState('')
  const [result, setResult]     = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading]   = useState(false)

  async function startBattle() {
    setLoading(true)
    const res  = await fetch(`/api/battles/${battleId}/start`, { method: 'POST' })
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">🧪 API Test Page</h1>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Battle ID</label>
          <input
            value={battleId}
            onChange={e => setBattleId(e.target.value)}
            placeholder="Paste battle UUID here"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          />
        </div>

        <button
          onClick={startBattle}
          disabled={loading || !battleId}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-6 py-2 rounded-lg font-semibold transition"
        >
          {loading ? 'Starting...' : 'Start Battle'}
        </button>

        {result && (
          <div className="bg-gray-800 rounded-lg p-4 mt-4">
            <p className="text-green-400 text-sm font-semibold mb-2">Response:</p>
            <pre className="text-xs text-gray-300 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}