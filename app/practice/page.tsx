'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Category  = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'fractions' | 'order_of_ops'
type Difficulty = 'easy' | 'medium' | 'hard'

const CATEGORIES = [
  { id: 'addition',       label: 'Addition',       emoji: '➕', desc: 'e.g. 47 + 83',      hasOptions: true  },
  { id: 'subtraction',    label: 'Subtraction',    emoji: '➖', desc: 'e.g. 91 - 34',      hasOptions: true  },
  { id: 'multiplication', label: 'Multiplication', emoji: '✖️', desc: 'e.g. 7 × 8',        hasOptions: true  },
  { id: 'division',       label: 'Division',       emoji: '➗', desc: 'e.g. 56 ÷ 7',       hasOptions: true  },
  { id: 'fractions',      label: 'Fractions',      emoji: '½',  desc: 'e.g. 1/2 + 3/4',   hasOptions: false },
  { id: 'order_of_ops',   label: 'Order of Ops',   emoji: '🔢', desc: 'e.g. (3+4) × 5',   hasOptions: false },
]

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   emoji: '🐢', desc: '15 secs per question' },
  { id: 'medium', label: 'Medium', emoji: '🐇', desc: '10 secs per question' },
  { id: 'hard',   label: 'Hard',   emoji: '🚀', desc: '6 secs per question'  },
]

const TIMES_TABLES = [1,2,3,4,5,6,7,8,9,10,11,12]
const MAX_NUMBERS  = [10, 20, 50, 100, 500, 1000]

export default function PracticePage() {
  const router = useRouter()

  const [category,   setCategory]   = useState<Category | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [questions,  setQuestions]  = useState(10)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Sub-options
  const [timesTable, setTimesTable] = useState<number | 'all'>('all')
  const [divisor,    setDivisor]    = useState<number | 'all'>('all')
  const [addMax,     setAddMax]     = useState<number>(100)
  const [subMax,     setSubMax]     = useState<number>(100)

  const selectedCat = CATEGORIES.find(c => c.id === category)

  async function startPractice() {
    if (!category || !difficulty) return
    setLoading(true)
    setError(null)

    // Build options based on category
    const options: Record<string, unknown> = {}
    if (category === 'multiplication' && timesTable !== 'all') options.timesTable = timesTable
    if (category === 'division'       && divisor    !== 'all') options.divisor    = divisor
    if (category === 'addition')       options.maxNumber = addMax
    if (category === 'subtraction')    options.maxNumber = subMax

    const res  = await fetch('/api/practice', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ category, difficulty, question_count: questions, options }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setLoading(false); return }
    router.push(`/practice/${data.session_id}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4">
      <div className="max-w-lg mx-auto pt-4 pb-20">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🎯 Practice Mode</h1>
          <p className="text-purple-300">Solo practice — no pressure, just math!</p>
        </div>

        {/* ── STEP 1: Category ── */}
        <div className="mb-6">
          <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-3 opacity-50">
            Step 1 · Choose a topic
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat.id as Category)
                  // Reset sub-options on category change
                  setTimesTable('all')
                  setDivisor('all')
                  setAddMax(100)
                  setSubMax(100)
                }}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  category === cat.id
                    ? 'border-purple-400 bg-purple-600/30 scale-[1.02]'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="text-3xl mb-2">{cat.emoji}</div>
                <div className="text-white font-bold text-sm">{cat.label}</div>
                <div className="text-white/40 text-xs mt-0.5">{cat.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── STEP 2: Sub-options (conditional) ── */}
        {category && selectedCat?.hasOptions && (
          <div className="mb-6 bg-white/5 rounded-2xl p-4 border border-white/10">

            {/* Multiplication — pick times table */}
            {category === 'multiplication' && (
              <>
                <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-3 opacity-50">
                  Step 2 · Which times table?
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTimesTable('all')}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      timesTable === 'all'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    🎲 All
                  </button>
                  {TIMES_TABLES.map(n => (
                    <button
                      key={n}
                      onClick={() => setTimesTable(n)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                        timesTable === n
                          ? 'bg-purple-600 text-white scale-110'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {timesTable !== 'all' && (
                  <p className="text-purple-300 text-xs mt-3">
                    Practice: {timesTable} × 1 to {timesTable} × 12
                  </p>
                )}
              </>
            )}

            {/* Division — pick divisor */}
            {category === 'division' && (
              <>
                <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-3 opacity-50">
                  Step 2 · Which divisor?
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDivisor('all')}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      divisor === 'all'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    🎲 All
                  </button>
                  {TIMES_TABLES.map(n => (
                    <button
                      key={n}
                      onClick={() => setDivisor(n)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                        divisor === n
                          ? 'bg-purple-600 text-white scale-110'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {divisor !== 'all' && (
                  <p className="text-purple-300 text-xs mt-3">
                    Practice: ? ÷ {divisor} = 1 to 12
                  </p>
                )}
              </>
            )}

            {/* Addition — pick max number */}
            {category === 'addition' && (
              <>
                <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-3 opacity-50">
                  Step 2 · Numbers up to...
                </h2>
                <div className="flex flex-wrap gap-2">
                  {MAX_NUMBERS.map(n => (
                    <button
                      key={n}
                      onClick={() => setAddMax(n)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        addMax === n
                          ? 'bg-purple-600 text-white scale-105'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
                <p className="text-purple-300 text-xs mt-3">
                  Practice: additions where both numbers are under {addMax.toLocaleString()}
                </p>
              </>
            )}

            {/* Subtraction — pick max number */}
            {category === 'subtraction' && (
              <>
                <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-3 opacity-50">
                  Step 2 · Numbers up to...
                </h2>
                <div className="flex flex-wrap gap-2">
                  {MAX_NUMBERS.map(n => (
                    <button
                      key={n}
                      onClick={() => setSubMax(n)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        subMax === n
                          ? 'bg-purple-600 text-white scale-105'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
                <p className="text-purple-300 text-xs mt-3">
                  Practice: subtractions where the larger number is under {subMax.toLocaleString()}
                </p>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Difficulty ── */}
        {category && (
          <div className="mb-6">
            <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-3 opacity-50">
              {selectedCat?.hasOptions ? 'Step 3' : 'Step 2'} · Choose difficulty
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map(diff => (
                <button
                  key={diff.id}
                  onClick={() => setDifficulty(diff.id as Difficulty)}
                  className={`p-4 rounded-2xl border-2 text-center transition-all ${
                    difficulty === diff.id
                      ? 'border-purple-400 bg-purple-600/30 scale-[1.02]'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="text-3xl mb-2">{diff.emoji}</div>
                  <div className="text-white font-bold text-sm">{diff.label}</div>
                  <div className="text-white/40 text-xs mt-1">{diff.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 4: Question count ── */}
        {category && difficulty && (
          <div className="mb-6 bg-white/5 rounded-2xl p-4 border border-white/10">
            <label className="text-white font-bold text-sm block mb-3">
              Questions: <span className="text-purple-300">{questions}</span>
            </label>
            <input
              type="range" min={5} max={30} step={5}
              value={questions}
              onChange={e => setQuestions(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-white/30 text-xs mt-1">
              <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl p-3 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          onClick={startPractice}
          disabled={!category || !difficulty || loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all text-lg hover:-translate-y-0.5 shadow-lg"
        >
          {loading       ? 'Starting...'         :
           !category     ? 'Pick a topic first'  :
           !difficulty   ? 'Pick a difficulty'   :
           '🎯 Start Practice!'}
        </button>

        <Link href="/lobby" className="block text-center text-white/30 hover:text-white/60 text-sm mt-4 transition">
          ← Back to lobby
        </Link>

      </div>
    </div>
  )
}