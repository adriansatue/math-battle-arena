import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 flex flex-col">

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="mb-6 text-8xl drop-shadow-2xl animate-bounce">⚔️</div>

        <h1 className="text-6xl sm:text-7xl font-black text-white tracking-tight leading-none mb-4">
          Math Battle
          <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Arena
          </span>
        </h1>

        <p className="text-purple-200 text-xl max-w-md mb-10 leading-relaxed">
          Challenge real players or AI bots in fast-paced maths duels.
          Climb the ranks. Become the ultimate Math Champion.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Link
            href="/signup"
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-purple-900/50 transition-all hover:-translate-y-0.5 hover:shadow-2xl text-center"
          >
            Play Free 🚀
          </Link>
          <Link
            href="/login"
            className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-lg py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-center backdrop-blur-sm"
          >
            Sign In
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="px-4 pb-20">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { emoji: '⚡', title: 'Real-time Battles', desc: 'Answer faster than your opponent and steal first-answer bonuses' },
            { emoji: '🤖', title: 'AI Opponents', desc: 'No one online? Battle smart bots at easy, medium or hard difficulty' },
            { emoji: '🎯', title: 'Practice Mode', desc: 'Drill specific categories like times tables, fractions or order of ops' },
          ].map(f => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm hover:bg-white/10 transition"
            >
              <div className="text-4xl mb-3">{f.emoji}</div>
              <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-purple-300 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-8 text-purple-400/50 text-xs">
        Math Battle Arena — sharpen your mind, one battle at a time
      </footer>

    </div>
  )
}
