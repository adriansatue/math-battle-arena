import Link from 'next/link'

export const metadata = {
  title: 'Data Protection & Privacy – Math Battle Arena',
  description: 'How Math Battle Arena collects, uses, shares, and protects personal information.',
}

export default function DataProtectionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="space-y-2">
          <Link href="/lobby" className="text-purple-400 hover:text-purple-300 text-sm transition">← Back</Link>
          <h1 className="text-3xl font-black text-white">🔐 Data Protection &amp; Privacy</h1>
          <p className="text-white/40 text-sm">Last updated: 16 August 2026</p>
          <p className="max-w-xl text-sm leading-relaxed text-white/65">
            This notice explains what personal information Math Battle Arena uses, why we use it,
            and the choices and rights available to you.
          </p>
        </div>

        <Section title="1. Who we are">
          Math Battle Arena (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is responsible for deciding how personal information
          collected through the Service is used. In data protection law, this means we act as the data
          controller. You can contact us at{' '}
          <a href="mailto:privacy@mathbattlearena.com" className="text-purple-400 hover:text-purple-300 transition">
            privacy@mathbattlearena.com
          </a>.
        </Section>

        <Section title="2. Information we collect">
          <ul className="list-disc list-inside space-y-2 text-white/70">
            <li><strong className="text-white/90">Account information</strong> — email address, username, account identifier, login method, and authentication records.</li>
            <li><strong className="text-white/90">Profile information</strong> — display name, XP, coins, rating, level, rank, streaks, and win/loss record.</li>
            <li><strong className="text-white/90">Game and feature activity</strong> — battles, practice sessions, submitted answers, response times, scores, rewards, card inventory, feature views, and interactions such as opening answer review.</li>
            <li><strong className="text-white/90">Technical and security information</strong> — IP address, browser or device information, session identifiers, and service logs.</li>
            <li><strong className="text-white/90">Messages</strong> — information you include when contacting support or exercising a data protection right.</li>
          </ul>
          <p className="mt-3">Please do not include sensitive personal information in your username or support messages.</p>
        </Section>

        <Section title="3. Why we use it">
          <ul className="list-disc list-inside space-y-2 text-white/70">
            <li><strong className="text-white/90">Provide the Service</strong> — create your account, run games, calculate results, save progress, and deliver rewards.</li>
            <li><strong className="text-white/90">Operate social features</strong> — show usernames, levels, ratings, and results on profiles and leaderboards.</li>
            <li><strong className="text-white/90">Protect the Service</strong> — authenticate users and detect cheating, abuse, fraud, and technical failures.</li>
            <li><strong className="text-white/90">Improve the Service</strong> — understand performance and improve game balance and reliability.</li>
            <li><strong className="text-white/90">Communicate with you</strong> — answer support enquiries and data protection requests, send optional game reminders, and share an optional newsletter about major game updates where you have enabled each type of email. You can manage both choices independently in your profile or unsubscribe from an email.</li>
          </ul>
        </Section>

        <Section title="4. Our legal bases">
          Depending on the activity, we rely on:
          <ul className="list-disc list-inside mt-2 space-y-2 text-white/70">
            <li><strong className="text-white/90">Contract</strong> — where information is needed to provide the account and game features you request.</li>
            <li><strong className="text-white/90">Consent</strong> — for optional game reminders and newsletters. You can withdraw either choice independently at any time.</li>
            <li><strong className="text-white/90">Legitimate interests</strong> — to secure, maintain, understand, and improve the Service, provided those interests do not override your rights.</li>
            <li><strong className="text-white/90">Legal obligation</strong> — where we must keep, use, or disclose information to comply with the law.</li>
          </ul>
        </Section>

        <Section title="5. Public information">
          Your username, level, rank, rating, XP, and game statistics may be visible to other players on
          profiles, leaderboards, battles, and results pages. Your email address, authentication details,
          private performance breakdown, and support messages are not intended to be public. Do not use
          your real name as a username unless you want it to be visible to other players.
        </Section>

        <Section title="6. Service providers and disclosures">
          We do not sell personal information. We use service providers to operate hosting, databases,
          authentication, security, and other technical infrastructure. They may process information only
          to provide those services to us and under appropriate contractual safeguards. We may also
          disclose information where required by law, to protect users or the Service, or in connection
          with a reorganisation or transfer of the Service.
          <ul className="list-disc list-inside mt-2 space-y-2 text-white/70">
            <li><strong className="text-white/90">Supabase</strong> provides database and authentication infrastructure.</li>
            <li><strong className="text-white/90">Resend</strong> delivers optional game reminders and newsletters to players who enable them.</li>
            <li><strong className="text-white/90">Hosting and infrastructure providers</strong> deliver and protect the application.</li>
          </ul>
        </Section>

        <Section title="7. International transfers and security">
          Our service providers may process information in countries outside the UK. Where data protection
          law requires it, we use recognised safeguards for those transfers. We use technical and
          organisational measures designed to protect personal information, including access controls and
          encrypted connections. No online service can guarantee absolute security.
        </Section>

        <Section title="8. How long we keep information">
          We keep account and game information while your account is active and for as long as reasonably
          needed to operate the Service, resolve disputes, prevent abuse, maintain accurate records, and
          meet legal obligations. Retention periods depend on the type of record and why it is needed.
          Information is deleted or anonymised when it is no longer required. You may request account
          deletion, subject to information we are permitted or required to retain.
        </Section>

        <Section title="9. Your data protection rights">
          Depending on the circumstances, UK data protection law may give you the right to:
          <ul className="list-disc list-inside mt-2 space-y-2 text-white/70">
            <li><strong className="text-white/90">Access</strong> — request a copy of the personal data we hold about you.</li>
            <li><strong className="text-white/90">Rectification</strong> — ask us to correct inaccurate data.</li>
            <li><strong className="text-white/90">Erasure</strong> — ask us to delete personal data in certain circumstances.</li>
            <li><strong className="text-white/90">Restriction</strong> — ask us to limit how we use your data.</li>
            <li><strong className="text-white/90">Portability</strong> — receive certain information in a structured, machine-readable format.</li>
            <li><strong className="text-white/90">Objection</strong> — object to processing based on legitimate interests.</li>
          </ul>
          <p className="mt-3">
          To exercise a right, contact us at{' '}
          <a href="mailto:privacy@mathbattlearena.com" className="text-purple-400 hover:text-purple-300 transition">
            privacy@mathbattlearena.com
          </a>. We may need to verify your identity. We normally respond within one month, although the law
          allows more time in some circumstances. These rights are not absolute and legal exemptions may apply.
          </p>
        </Section>

        <Section title="10. Children">
          If you are under 13, a parent or guardian should create and supervise your account. A parent or
          guardian may contact us about a child&apos;s information or request that the child&apos;s account be deleted.
          Users should avoid putting a child&apos;s real name or other identifying information in a public username.
        </Section>

        <Section title="11. Cookies">
          For information on how we use cookies, see our{' '}
          <Link href="/legal/cookies" className="text-purple-400 hover:text-purple-300 transition">
            Cookies Policy
          </Link>.
        </Section>

        <Section title="12. Changes to this notice">
          We may update this notice when our practices, the Service, or applicable law changes. We will
          update the date at the top and provide an appropriate notice where a change materially affects
          how personal information is used.
        </Section>

        <Section title="13. Questions and complaints">
          <p>
            For a concern about how we use your personal information or handle a data protection right,
            please email{' '}
            <a href="mailto:privacy@mathbattlearena.com" className="text-purple-400 hover:text-purple-300 transition">
              privacy@mathbattlearena.com
            </a>{' '}
            first so we have an opportunity to investigate and put things right.
          </p>
          <p>
            If you remain dissatisfied with our handling of a personal information concern, you may be
            entitled to complain to the UK Information Commissioner&apos;s Office. The ICO is the independent
            UK data protection regulator. Its complaints process covers privacy and personal information;
            it does not handle general gameplay, account, moderation, or customer-service disputes. Visit the{' '}
            <a
              href="https://ico.org.uk/make-a-complaint/data-complaints-complaints/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition"
            >
              ICO data protection complaints page
            </a>.
          </p>
          <p>
            For a general question or complaint about the Service, contact{' '}
            <a href="mailto:support@mathbattlearena.com" className="text-purple-400 hover:text-purple-300 transition">
              support@mathbattlearena.com
            </a>.
          </p>
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
      <Link href="/legal/cookies" className="hover:text-white/60 transition">Cookies Policy</Link>
      <Link href="/legal/terms"   className="hover:text-white/60 transition">Terms &amp; Conditions</Link>
    </div>
  )
}
