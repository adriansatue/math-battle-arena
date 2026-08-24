'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface FlaggedAnswer {
  id:                  string
  answer_given:        number
  time_taken_ms:       number
  server_validated_ms: number
  points_earned:       number
  answered_at:         string
  player_id:           string
  profiles:            { username: string } | null
  battle_questions:    { question_text: string; correct_answer: number } | null
}

export default function AdminFlaggedPage() {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [answers,  setAnswers]  = useState<FlaggedAnswer[]>([])
  const [loading,  setLoading]  = useState(true)
  const [clearing, setClearing] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/lobby'); return }

      const res = await fetch('/api/admin/flagged')
      if (!res.ok) {
        setAnswers([])
        setLoading(false)
        return
      }

      const data = await res.json()
      setAnswers((data.answers as FlaggedAnswer[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function clearFlag(id: string) {
    setMessage('')
    setClearing(id)
    const res = await fetch(`/api/admin/flagged/${id}`, { method: 'PATCH' })
    if (res.ok) setAnswers(prev => prev.filter(a => a.id !== id))
    else setMessage('No se pudo marcar la respuesta como revisada.')
    setClearing(null)
  }

  async function clearAll() {
    if (!window.confirm(`Se marcarán como revisadas ${answers.length} respuestas. Esta acción no se puede deshacer. ¿Continuar?`)) return
    setClearingAll(true)
    setMessage('')
    const res = await fetch('/api/admin/flagged', { method: 'PATCH' })
    if (res.ok) {
      setAnswers([])
      setMessage('Todas las respuestas se marcaron como revisadas.')
    } else {
      setMessage('No se pudieron revisar todas las respuestas.')
    }
    setClearingAll(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white animate-pulse">Cargando respuestas...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">Volver al panel</Link>
            <h1 className="text-2xl font-bold text-white mt-1">Respuestas marcadas</h1>
          </div>
          {answers.length > 0 && (
            <button onClick={clearAll} disabled={clearingAll || clearing !== null}
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition">
              {clearingAll ? 'Revisando...' : `Marcar todas como revisadas (${answers.length})`}
            </button>
          )}
        </div>

        {message && <p role="status" className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">{message}</p>}

        {answers.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">OK</div>
            <p className="text-white font-bold text-xl mb-2">No hay respuestas pendientes</p>
            <p className="text-gray-400">El sistema no ha marcado actividad para revisar.</p>
          </div>
        ) : (
          <div className="hidden bg-gray-900 rounded-2xl border border-gray-800 overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 text-xs p-4">Jugador</th>
                  <th className="text-left text-gray-400 text-xs p-4">Pregunta</th>
                  <th className="text-left text-gray-400 text-xs p-4">Respuesta</th>
                  <th className="text-left text-gray-400 text-xs p-4">Cliente</th>
                  <th className="text-left text-gray-400 text-xs p-4">Servidor</th>
                  <th className="text-left text-gray-400 text-xs p-4">Puntos</th>
                  <th className="text-left text-gray-400 text-xs p-4">Acción</th>
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
                          Correcta: {correct}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm font-bold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                          {a.answer_given} {isCorrect ? 'correcta' : 'incorrecta'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-300 text-sm">{a.time_taken_ms}ms</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm ${suspicious ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                          {a.server_validated_ms}ms
                          {suspicious && ' sospechoso'}
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
                          {clearing === a.id ? 'Revisando...' : 'Marcar revisada'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {answers.length > 0 && (
          <div className="space-y-3 md:hidden">
            {answers.map(answer => {
              const correct = answer.battle_questions?.correct_answer
              const suspicious = answer.time_taken_ms < answer.server_validated_ms - 2000
              return (
                <article key={answer.id} className={`rounded-xl border p-4 ${suspicious ? 'border-red-500/30 bg-red-950/20' : 'border-gray-800 bg-gray-900'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{answer.profiles?.username ?? 'Desconocido'}</p>
                      <p className="text-xs text-gray-500">{new Date(answer.answered_at).toLocaleString('es')}</p>
                    </div>
                    {suspicious && <span className="rounded bg-red-500/15 px-2 py-1 text-xs font-bold text-red-300">Sospechosa</span>}
                  </div>
                  <p className="mt-3 font-mono text-sm text-gray-300">{answer.battle_questions?.question_text}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <p>Respuesta: <span className="font-bold text-white">{answer.answer_given}</span></p>
                    <p>Correcta: <span className="font-bold text-white">{correct}</span></p>
                    <p>Cliente: {answer.time_taken_ms}ms</p>
                    <p>Servidor: {answer.server_validated_ms}ms</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void clearFlag(answer.id)}
                    disabled={clearing === answer.id || clearingAll}
                    className="mt-4 w-full rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-bold text-emerald-200 disabled:opacity-50"
                  >
                    {clearing === answer.id ? 'Revisando...' : 'Marcar como revisada'}
                  </button>
                </article>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
