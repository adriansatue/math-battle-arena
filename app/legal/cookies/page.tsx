import Link from 'next/link'

export const metadata = {
  title: 'Cookies Policy – Math Battle Arena',
}

export default function CookiesPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="space-y-2">
          <Link href="/lobby" className="text-purple-400 hover:text-purple-300 text-sm transition">← Back</Link>
          <h1 className="text-3xl font-black text-white">🍪 Cookies Policy</h1>
          <p className="text-white/40 text-sm">Last updated: March 2026</p>
        </div>

        <Section title="What are cookies?">
          Cookies are small text files placed on your device when you visit a website. They help the site
          remember your preferences and session state so you don&apos;t have to log in every time.
        </Section>

        <Section title="What cookies do we use?">
          <ul className="list-disc list-inside space-y-2 text-white/70">
            <li>
              <strong className="text-white/90">Authentication cookies</strong> — set by Supabase to keep
              you logged in securely across page loads. These are strictly necessary and cannot be disabled.
            </li>
            <li>
              <strong className="text-white/90">Session cookies</strong> — temporary cookies that expire
              when you close your browser, used to maintain your game session state.
            </li>
            <li>
              <strong className="text-white/90">Preference cookies</strong> — remember settings such as
              your chosen difficulty level so you don&apos;t have to re-select them each visit.
            </li>
          </ul>
        </Section>

        <Section title="What we do NOT use">
          We do not use any advertising, tracking, or third-party analytics cookies. We do not share
          cookie data with any external parties.
        </Section>

        <Section title="Managing cookies">
          You can control and delete cookies through your browser settings at any time. Please note that
          disabling authentication cookies will prevent you from logging in to Math Battle Arena.
          <br /><br />
          Useful links:
          <ul className="list-disc list-inside mt-2 space-y-1 text-purple-400">
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition">Chrome cookie settings</a></li>
            <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition">Firefox cookie settings</a></li>
            <li><a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition">Safari cookie settings</a></li>
          </ul>
        </Section>

        <Section title="Changes to this policy">
          We may update this Cookies Policy from time to time. Any changes will be posted on this page
          with an updated date.
        </Section>

        <Section title="Contact">
          If you have questions about our use of cookies, please contact us at{' '}
          <a href="mailto:support@mathbattlearena.com" className="text-purple-400 hover:text-purple-300 transition">
            support@mathbattlearena.com
          </a>.
        </Section>

        <Footer />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
      <h2 className="text-white font-bold text-lg">{title}</h2>
      <div className="text-white/70 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Footer() {
  return (
    <div className="flex gap-4 text-xs text-white/30 pt-4">
      <Link href="/legal/terms"           className="hover:text-white/60 transition">Terms &amp; Conditions</Link>
      <Link href="/legal/data-protection" className="hover:text-white/60 transition">Data Protection</Link>
    </div>
  )
}
