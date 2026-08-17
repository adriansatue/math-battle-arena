import Link from 'next/link'
import { UnsubscribeButton } from '@/components/email/UnsubscribeButton'

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#130b24] px-5 text-white">
      <section className="w-full max-w-md border border-white/15 bg-white/[0.06] p-6 text-center">
        <p className="text-xs font-bold uppercase text-amber-300">Math Battle Arena</p>
        <h1 className="mt-2 text-2xl font-black">Stop game reminders?</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">This only stops optional return-to-play reminders. Account and security emails are unaffected.</p>
        {token ? <UnsubscribeButton token={token} /> : <p className="mt-6 text-sm text-red-300">This unsubscribe link is invalid.</p>}
        <Link href="/" className="mt-6 block text-sm font-semibold text-white/45 hover:text-white">Return to Math Battle Arena</Link>
      </section>
    </main>
  )
}