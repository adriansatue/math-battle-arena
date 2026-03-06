'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FlaggedAnswer {
  id:                  string
  answer_given:        number
  time_taken_ms:       number
  server_validated_ms: number
  points_earned:       number
  answered_at:         string
  player_id:           string
  profiles:            { username: string }
  battle_questions:    { question_text: string; correct_answer: number }
}

export default function AdminFlaggedPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [answers,  setAnswers]  = useState<FlaggedAnswer[]>([])
  const [loading,  setLoading]  = useState(true)
  const [clearing, setClearing] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/lobby'); return }

      const { data } = await supabase
        .from('battle_answers')
        .select(`
          id, answer_given, time_taken_ms, server_validated_ms,
          points_earned, answered_at, player_id,
          profiles ( username ),
          battle_questions ( question_text, correct_answer )
        `)
        .eq('flagged', true)
        .order('answered_at', { ascending: false })
        .limit(100)

      setAnswers((data as unknown as FlaggedAnswer[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function clearFlag(id: string) {
    setClearing(id)
    await supabase
      .from('battle_answers')
      .update({ flagged: false })
      .eq('id', id)
    setAnswers(prev => prev.filter(a => a.id !== id))
    setClearing(null)
  }

  async function clearAll() {
    await supabase
      .from('battle_answers')
      .update({ flagged: false })
      .eq('flagged', true)
    setAnswers([])
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white animate-pulse">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Admin</Link>
            <h1 className="text-2xl font-bold text-white mt-1">🚩 Flagged Answers</h1>
          </div>
          {answers.length > 0 && (
            <button onClick={clearAll}
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition">
              ✅ Clear All Flags
            </button>
          )}
        </div>

        {answers.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-white font-bold text-xl mb-2">No flagged answers!</p>
            <p className="text-gray-400">The anti-cheat system has not flagged anything suspicious.</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 text-xs p-4">Player</th>
                  <th className="text-left text-gray-400 text-xs p-4">Question</th>
                  <th className="text-left text-gray-400 text-xs p-4">Answer</th>
                  <th className="text-left text-gray-400 text-xs p-4">Client ms</th>
                  <th className="text-left text-gray-400 text-xs p-4">Server ms</th>
                  <th className="text-left text-gray-400 text-xs p-4">Points</th>
                  <th className="text-left text-gray-400 text-xs p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {answers.map(a => {
                  const correct = a.battle_questions?.correct_answer
                  const isCorrect = Number(a.answer_given) === Number(correct)
                  const suspicious = a.time_taken_ms < a.server_validated_ms - 2000

                  return (
                    <tr key={a.id} className={`border-b border-gray-800/50 ${suspicious ? 'bg-red-950/20' : ''}`}>
                      <td className="p-4">
                        <p className="text-white text-sm font-semibold">
                          {a.profiles?.username ?? 'Unknown'}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {new Date(a.answered_at).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-gray-300 text-sm font-mono">
                          {a.battle_questions?.question_text}
                        </p>
                        <p className="text-gray-500 text-xs">
                          Correct: {correct}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm font-bold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                          {a.answer_given} {isCorrect ? '✓' : '✗'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300 text-sm">{a.time_taken_ms}ms</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm ${suspicious ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                          {a.server_validated_ms}ms
                          {suspicious && ' ⚠️'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-white text-sm">{a.points_earned}</span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => clearFlag(a.id)}
                          disabled={clearing === a.id}
                          className="text-green-400 hover:text-green-300 text-xs font-semibold disabled:opacity-50 transition"
                        >
                          {clearing === a.id ? 'Clearing...' : 'Clear Flag'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}