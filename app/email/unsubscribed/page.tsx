import Link from 'next/link'

export default async function UnsubscribedPage({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  const invalid = Boolean((await searchParams).invalid)
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#130b24] px-5 text-white">
      <section className="w-full max-w-md border border-white/15 bg-white/[0.06] p-6 text-center">
        <h1 className="text-2xl font-black">{invalid ? 'Link unavailable' : 'Email reminders stopped'}</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          {invalid ? 'This unsubscribe link is invalid.' : 'You will no longer receive optional return-to-play emails. Account and security emails are unaffected.'}
        </p>
        <Link href="/" className="mt-6 inline-block bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">Math Battle Arena</Link>
      </section>
    </main>
  )
}