'use client'

import { useEffect, useRef, useState } from 'react'

interface QuestionCardProps {
  sequence:       number
  total:          number
  questionText:   string
  onAnswer:       (answer: number) => void
  disabled:       boolean
  lastResult?:    { correct: boolean; points: number } | null
  pendingAnswer?: number | null
  correctAnswer?: number | null   // revealed when wrong
  showProgress?:  boolean         // default true
}

export function QuestionCard({
  sequence, total, questionText, onAnswer, disabled,
  lastResult, pendingAnswer, correctAnswer, showProgress = true,
}: QuestionCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null)

  // Focus + clear input when question changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
    setFlash(null)
  }, [questionText])

  // Trigger border flash when result arrives
  useEffect(() => {
    if (!lastResult) return
    setFlash(lastResult.correct ? 'correct' : 'wrong')
  }, [lastResult])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(inputRef.current?.value ?? '')
    if (isNaN(num)) return
    onAnswer(num)
  }

  const borderCls =
    flash === 'correct'   ? 'border-green-400/80 shadow-green-500/20' :
    flash === 'wrong'     ? 'border-red-400/80 shadow-red-500/20'     :
    pendingAnswer != null ? 'border-yellow-400/50'                    :
                            'border-white/20'

  const bgCls =
    flash === 'correct' ? 'bg-green-500/10' :
    flash === 'wrong'   ? 'bg-red-500/10'   :
                          'bg-white/5'

  return (
    <div className={`
      relative backdrop-blur-sm rounded-2xl p-6 border-2 shadow-xl
      transition-all duration-300
      ${bgCls} ${borderCls}
    `}>

      {/* Progress pill bar */}
      {showProgress && (
        <div className="flex gap-1 justify-center mb-4">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
              i < sequence - 1   ? 'w-5 bg-purple-500' :
              i === sequence - 1 ? 'w-5 bg-white' :
                                   'w-2 bg-white/20'
            }`}/>
          ))}
        </div>
      )}

      {/* Counter label */}
      <p className="text-center text-purple-300 text-xs font-bold uppercase tracking-widest mb-3">
        Question {sequence} / {total}
      </p>

      {/* Question text */}
      <div className="text-center my-6 min-h-[80px] flex items-center justify-center">
        <p className={`font-black text-white tracking-tight leading-none ${
          questionText.length > 20 ? 'text-4xl' : 'text-6xl'
        }`}>
          {questionText} = ?
        </p>
      </div>

      {/* Feedback row */}
      <div className="min-h-[36px] flex items-center justify-center mb-4">
        {lastResult ? (
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${
            lastResult.correct
              ? 'bg-green-500/20 text-green-300'
              : 'bg-red-500/20 text-red-300'
          }`}>
            {lastResult.correct ? (
              <>✅ Correct! <span className="text-green-200 ml-1">+{lastResult.points} pts</span></>
            ) : (
              <>
                ❌ Wrong
                {correctAnswer != null && (
                  <> — answer: <span className="text-white font-black ml-1">{correctAnswer}</span></>
                )}
              </>
            )}
          </div>
        ) : pendingAnswer != null ? (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold bg-yellow-500/10 text-yellow-300">
            <span className="inline-block w-3.5 h-3.5 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin"/>
            Checking {pendingAnswer}…
          </div>
        ) : null}
      </div>

      {/* Answer form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          ref={inputRef}
          type="number"
          step="any"
          inputMode="decimal"
          defaultValue=""
          disabled={disabled}
          placeholder="Your answer…"
          className="
            flex-1 bg-white/10 border-2 border-white/20 rounded-xl
            px-4 py-3.5 text-white text-2xl font-bold text-center
            placeholder-white/25
            focus:outline-none focus:border-purple-400 focus:bg-white/15
            disabled:opacity-40 disabled:pointer-events-none
            transition-all
          "
        />
        <button
          type="submit"
          disabled={disabled}
          className="
            bg-purple-600 hover:bg-purple-500 active:scale-95
            disabled:opacity-40 disabled:pointer-events-none
            text-white font-black text-xl px-7 rounded-xl
            transition-all hover:scale-105 shadow-lg shadow-purple-900/40
          "
        >
          ✓
        </button>
      </form>
    </div>
  )
}