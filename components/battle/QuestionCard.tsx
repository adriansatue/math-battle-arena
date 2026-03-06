'use client'

import { useEffect, useRef } from 'react'

interface QuestionCardProps {
  sequence:     number
  total:        number
  questionText: string
  onAnswer:     (answer: number) => void
  disabled:     boolean
  lastResult?:  { correct: boolean; points: number } | null
}

export function QuestionCard({
  sequence, total, questionText, onAnswer, disabled, lastResult
}: QuestionCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset input when question changes using ref — no setState needed
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
  }, [questionText])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(inputRef.current?.value ?? '')
    if (isNaN(num)) return
    onAnswer(num)
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">

      {/* Progress bar */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-purple-300 text-sm font-semibold">
          Question {sequence} of {total}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${
              i < sequence - 1   ? 'w-4 bg-purple-500' :
              i === sequence - 1 ? 'w-4 bg-white' :
                                   'w-2 bg-white/20'
            }`}/>
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="text-center my-8">
        <p className="text-5xl font-bold text-white tracking-tight">
          {questionText} = ?
        </p>
      </div>

      {/* Last result feedback */}
      {lastResult && (
        <div className={`text-center mb-4 text-sm font-semibold ${
          lastResult.correct ? 'text-green-400' : 'text-red-400'
        }`}>
          {lastResult.correct
            ? `✅ Correct! +${lastResult.points} pts`
            : '❌ Wrong!'}
        </div>
      )}

      {/* Answer input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          ref={inputRef}
          type="number"
          step="any"
          defaultValue=""
          disabled={disabled}
          placeholder="Your answer..."
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-xl font-bold text-center placeholder-white/30 focus:outline-none focus:border-purple-400 disabled:opacity-40 transition"
        />
        <button
          type="submit"
          disabled={disabled}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-6 rounded-xl transition-all hover:scale-105 active:scale-95"
        >
          ✓
        </button>
      </form>
    </div>
  )
}