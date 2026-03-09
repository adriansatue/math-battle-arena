'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Category   = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'fractions' | 'order_of_ops'
type Difficulty = 'easy' | 'medium' | 'hard'
type AnswerMode = 'typed' | 'multiple_choice'

const CATEGORIES = [
  {
    id: 'addition', label: 'Addition', emoji: '➕',
    desc: '47 + 83', color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20', hasOptions: true,
  },
  {
    id: 'subtraction', label: 'Subtraction', emoji: '➖',
    desc: '91 − 34', color: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-500/10', border: 'border-rose-500/30',
    glow: 'shadow-rose-500/20', hasOptions: true,
  },
  {
    id: 'multiplication', label: 'Multiply', emoji: '✖️',
    desc: '7 × 8', color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-500/10', border: 'border-violet-500/30',
    glow: 'shadow-violet-500/20', hasOptions: true,
  },
  {
    id: 'division', label: 'Division', emoji: '➗',
    desc: '56 ÷ 7', color: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-500/10', border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20', hasOptions: true,
  },
  {
    id: 'fractions', label: 'Fractions', emoji: '½',
    desc: '1/2 + 3/4', color: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500/10', border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/20', hasOptions: false,
  },
  {
    id: 'order_of_ops', label: 'Order of Ops', emoji: '🔢',
    desc: '(3+4) × 5', color: 'from-fuchsia-500 to-pink-600',
    bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30',
    glow: 'shadow-fuchsia-500/20', hasOptions: false,
  },
]

const DIFFICULTIES = [
  {
    id: 'easy', label: 'Easy', emoji: '🐢',
    desc: '15 seconds', sub: 'Perfect for warming up',
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-500/10', border: 'border-green-500/30',
  },
  {
    id: 'medium', label: 'Medium', emoji: '🐇',
    desc: '10 seconds', sub: 'A solid challenge',
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10', border: 'border-amber-500/30',
  },
  {
    id: 'hard', label: 'Hard', emoji: '🚀',
    desc: '6 seconds', sub: 'For math masters only',
    color: 'from-red-500 to-rose-600',
    bg: 'bg-red-500/10', border: 'border-red-500/30',
  },
]

const TIMES_TABLES = [1,2,3,4,5,6,7,8,9,10,11,12]
const MAX_NUMBERS  = [10, 20, 50, 100, 500, 1000]

export default function PracticePage() {
  const router = useRouter()

  const [category,   setCategory]   = useState<Category | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [answerMode, setAnswerMode] = useState<AnswerMode | null>(null)
  const [questions,  setQuestions]  = useState(10)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [timesTable, setTimesTable] = useState<number | 'all'>('all')
  const [divisor,    setDivisor]    = useState<number | 'all'>('all')
  const [addMax,     setAddMax]     = useState<number>(100)
  const [subMax,     setSubMax]     = useState<number>(100)

  const selectedCat  = CATEGORIES.find(c => c.id === category)

  // Step tracking for progress indicator
  const step = !category ? 1
    : selectedCat?.hasOptions
      ? (!answerMode ? 3 : !difficulty ? 4 : 5)
      : (!answerMode ? 2 : !difficulty ? 3 : 4)

  async function startPractice() {
    if (!category || !difficulty || !answerMode) return
    setLoading(true)
    setError(null)

    const options: Record<string, unknown> = {}
    if (category === 'multiplication' && timesTable !== 'all') options.timesTable = timesTable
    if (category === 'division'       && divisor    !== 'all') options.divisor    = divisor
    if (category === 'addition')       options.maxNumber = addMax
    if (category === 'subtraction')    options.maxNumber = subMax

    const res  = await fetch('/api/practice', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ category, difficulty, question_count: questions, options, answer_mode: answerMode }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    router.push(`/practice/${data.session_id}?mode=${answerMode}`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] p-4 pb-24">

      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl"/>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl"/>
        {selectedCat && (
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r ${selectedCat.color} opacity-5 rounded-full blur-3xl transition-all duration-700`}/>
        )}
      </div>

      <div className="max-w-lg mx-auto relative">

        {/* Header */}
        <div className="text-center pt-6 pb-8">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4">
            <span className="text-xs text-purple-300 font-semibold tracking-widest uppercase">Solo Practice</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight">
            Train Your<br/>
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Math Skills
            </span>
          </h1>
          <p className="text-white/40 text-sm">No opponents. No pressure. Just you vs the numbers.</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8">
          {['Topic', selectedCat?.hasOptions ? 'Options' : null, 'Answer', 'Difficulty', 'Go!']
            .filter(Boolean)
            .map((label, i) => {
              const stepNum = i + 1
              const isActive = step === stepNum
              const isDone   = step > stepNum
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-1.5 transition-all ${isActive ? 'opacity-100' : isDone ? 'opacity-60' : 'opacity-20'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isDone   ? 'bg-green-500 text-white' :
                      isActive ? 'bg-purple-500 text-white' :
                                 'bg-white/10 text-white/40'
                    }`}>
                      {isDone ? '✓' : stepNum}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:block ${isActive ? 'text-white' : 'text-white/40'}`}>
                      {label}
                    </span>
                  </div>
                  {label !== 'Go!' && <div className={`h-px flex-1 transition-all ${isDone ? 'bg-green-500/50' : 'bg-white/10'}`}/>}
                </div>
              )
            })}
        </div>

        {/* ── STEP 1: Category ── */}
        <div className="mb-6">
          <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-3">
            Choose a topic
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat.id as Category)
                  setTimesTable('all')
                  setDivisor('all')
                  setAddMax(100)
                  setSubMax(100)
                  setDifficulty(null)
                  setAnswerMode(null)
                }}
                className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 overflow-hidden group ${
                  category === cat.id
                    ? `${cat.bg} ${cat.border} shadow-lg ${cat.glow} scale-[1.02]`
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20 hover:scale-[1.01]'
                }`}
              >
                {/* Gradient orb on selected */}
                {category === cat.id && (
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${cat.color} opacity-20 rounded-full blur-xl -translate-y-4 translate-x-4`}/>
                )}
                <div className="text-3xl mb-3">{cat.emoji}</div>
                <div className="text-white font-bold text-sm">{cat.label}</div>
                <div className={`text-xs mt-1 font-mono transition-colors ${
                  category === cat.id ? 'text-white/60' : 'text-white/20'
                }`}>
                  {cat.desc}
                </div>
                {category === cat.id && (
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${cat.color}`}/>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── STEP 2: Sub-options ── */}
        {category && selectedCat?.hasOptions && (
          <div className="mb-6 bg-white/[0.03] rounded-2xl p-5 border border-white/10">

            {category === 'multiplication' && (
              <>
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-4">
                  Which times table?
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTimesTable('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      timesTable === 'all'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    🎲 Mixed
                  </button>
                  {TIMES_TABLES.map(n => (
                    <button
                      key={n}
                      onClick={() => setTimesTable(n)}
                      className={`w-11 h-11 rounded-xl text-sm font-black transition-all ${
                        timesTable === n
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30 scale-110'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {timesTable !== 'all' && (
                  <p className="text-violet-400 text-xs mt-3 font-semibold">
                    → Practicing {timesTable} × 1 through {timesTable} × 12
                  </p>
                )}
              </>
            )}

            {category === 'division' && (
              <>
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-4">
                  Which divisor?
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDivisor('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      divisor === 'all'
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    🎲 Mixed
                  </button>
                  {TIMES_TABLES.map(n => (
                    <button
                      key={n}
                      onClick={() => setDivisor(n)}
                      className={`w-11 h-11 rounded-xl text-sm font-black transition-all ${
                        divisor === n
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30 scale-110'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {divisor !== 'all' && (
                  <p className="text-amber-400 text-xs mt-3 font-semibold">
                    → Practicing ? ÷ {divisor} = 1 through 12
                  </p>
                )}
              </>
            )}

            {category === 'addition' && (
              <>
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-4">
                  Numbers up to...
                </p>
                <div className="flex flex-wrap gap-2">
                  {MAX_NUMBERS.map(n => (
                    <button
                      key={n}
                      onClick={() => setAddMax(n)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
                        addMax === n
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
                <p className="text-emerald-400 text-xs mt-3 font-semibold">
                  → Both numbers will be under {addMax.toLocaleString()}
                </p>
              </>
            )}

            {category === 'subtraction' && (
              <>
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-4">
                  Numbers up to...
                </p>
                <div className="flex flex-wrap gap-2">
                  {MAX_NUMBERS.map(n => (
                    <button
                      key={n}
                      onClick={() => setSubMax(n)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
                        subMax === n
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30 scale-105'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
                <p className="text-rose-400 text-xs mt-3 font-semibold">
                  → Larger number will be under {subMax.toLocaleString()}
                </p>
              </>
            )}
          </div>
        )}

        {/* ── STEP: Answer Mode ── */}
        {category && (
          <div className="mb-6">
            <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-3">
              {selectedCat?.hasOptions ? 'Step 3' : 'Step 2'} · How do you want to answer?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAnswerMode('typed')}
                className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                  answerMode === 'typed'
                    ? 'border-purple-400 bg-purple-600/30 scale-[1.02]'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 hover:scale-[1.01]'
                }`}
              >
                <div className="text-3xl mb-2">⌨️</div>
                <div className="text-white font-bold text-sm">Type Answer</div>
                <div className="text-white/40 text-xs mt-1">Full points</div>
              </button>
              <button
                onClick={() => setAnswerMode('multiple_choice')}
                className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                  answerMode === 'multiple_choice'
                    ? 'border-purple-400 bg-purple-600/30 scale-[1.02]'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 hover:scale-[1.01]'
                }`}
              >
                <div className="text-3xl mb-2">🔘</div>
                <div className="text-white font-bold text-sm">Multiple Choice</div>
                <div className="text-white/40 text-xs mt-1">60% points</div>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Difficulty ── */}
        {category && answerMode && (
          <div className="mb-6">
            <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-3">
              {selectedCat?.hasOptions ? 'Step 4' : 'Step 3'} · Choose difficulty
            </p>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map(diff => (
                <button
                  key={diff.id}
                  onClick={() => setDifficulty(diff.id as Difficulty)}
                  className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                    difficulty === diff.id
                      ? `${diff.bg} ${diff.border} scale-[1.03] shadow-lg`
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:scale-[1.01]'
                  }`}
                >
                  <div className="text-3xl mb-2">{diff.emoji}</div>
                  <div className="text-white font-black text-sm">{diff.label}</div>
                  <div className="text-white/40 text-xs mt-1">{diff.desc}</div>
                  {difficulty === diff.id && (
                    <div className="text-white/60 text-xs mt-1.5 italic">{diff.sub}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: Question count + Launch ── */}
        {category && answerMode && difficulty && (
          <div className="mb-6 bg-white/[0.03] rounded-2xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <label className="text-white font-bold text-sm">
                {selectedCat?.hasOptions ? 'Step 5' : 'Step 4'} · Number of questions
              </label>
              <span className={`text-2xl font-black bg-gradient-to-r ${selectedCat?.color} bg-clip-text text-transparent`}>
                {questions}
              </span>
            </div>
            <input
              type="range" min={5} max={30} step={5}
              value={questions}
              onChange={e => setQuestions(Number(e.target.value))}
              className="w-full accent-purple-500 mb-2"
            />
            <div className="flex justify-between text-white/20 text-xs">
              {[5,10,15,20,25,30].map(n => (
                <span key={n} className={questions === n ? 'text-white/60 font-bold' : ''}>{n}</span>
              ))}
            </div>

            {/* Session preview */}
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-white/30 text-xs mb-1">Topic</p>
                <p className="text-white text-sm font-bold">{selectedCat?.label}</p>
              </div>
              <div>
                <p className="text-white/30 text-xs mb-1">Mode</p>
                <p className="text-white text-sm font-bold">{answerMode === 'typed' ? '⌨️ Typed' : '🔘 M.Choice'}</p>
              </div>
              <div>
                <p className="text-white/30 text-xs mb-1">Est. Time</p>
                <p className="text-white text-sm font-bold">
                  {difficulty === 'easy' ? Math.ceil(questions * 15 / 60) :
                   difficulty === 'medium' ? Math.ceil(questions * 10 / 60) :
                   Math.ceil(questions * 6 / 60)} min
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 text-red-300 border border-red-500/20 rounded-xl p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={startPractice}
          disabled={!category || !difficulty || !answerMode || loading}
          className={`w-full relative overflow-hidden font-black py-5 rounded-2xl transition-all text-lg ${
            category && answerMode && difficulty
              ? `bg-gradient-to-r ${selectedCat?.color} text-white shadow-2xl hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(139,92,246,0.4)] active:translate-y-0`
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> Starting...
            </span>
          ) : !category ? (
            'Pick a topic first'
          ) : !answerMode ? (
            'Pick an answer style'
          ) : !difficulty ? (
            'Pick a difficulty'
          ) : (
            <span className="flex items-center justify-center gap-2">
              🎯 Start {questions} Questions!
            </span>
          )}
        </button>

        <div className="flex items-center justify-center gap-6 mt-5">
          <Link href="/lobby" className="text-white/20 hover:text-white/50 text-sm transition">
            ⚔️ Battle instead
          </Link>
          <span className="text-white/10">·</span>
          <Link href="/leaderboard" className="text-white/20 hover:text-white/50 text-sm transition">
            🏆 View Rankings
          </Link>
        </div>

      </div>
    </div>
  )
}
