import Link from 'next/link'

export const metadata = {
  title: 'Data Protection – Math Battle Arena',
}

export default function DataProtectionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="space-y-2">
          <Link href="/lobby" className="text-purple-400 hover:text-purple-300 text-sm transition">← Back</Link>
          <h1 className="text-3xl font-black text-white">🔐 Data Protection &amp; Privacy</h1>
          <p className="text-white/40 text-sm">Last updated: March 2026</p>
        </div>

        <Section title="1. Who we are">
          Math Battle Arena (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is the controller of personal data collected through this
          Service. We are committed to protecting your personal data in accordance with the UK General
          Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
        </Section>

        <Section title="2. What data we collect">
          <ul className="list-disc list-inside space-y-2 text-white/70">
            <li><strong className="text-white/90">Account data</strong> — email address and username provided on registration.</li>
            <li><strong className="text-white/90">Profile data</strong> — display name, total points, win/loss record, rank, and level.</li>
            <li><strong className="text-white/90">Game data</strong> — battle history, answers submitted, scores, and card inventory.</li>
            <li><strong className="text-white/90">Technical data</strong> — IP address, browser type, and session identifiers collected automatically by Supabase Auth.</li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          We use your personal data to:
          <ul className="list-disc list-inside mt-2 space-y-2 text-white/70">
            <li>Provide, maintain, and improve the Service.</li>
            <li>Authenticate you and keep your session secure.</li>
            <li>Display leaderboard rankings and battle results.</li>
            <li>Detect and prevent cheating or abuse.</li>
            <li>Respond to support requests.</li>
          </ul>
        </Section>

        <Section title="4. Legal basis for processing">
          We process your personal data based on:
          <ul className="list-disc list-inside mt-2 space-y-2 text-white/70">
            <li><strong className="text-white/90">Contract</strong> — processing necessary to provide the Service you signed up for.</li>
            <li><strong className="text-white/90">Legitimate interests</strong> — fraud prevention, security, and service improvement.</li>
            <li><strong className="text-white/90">Legal obligation</strong> — where required by applicable law.</li>
          </ul>
        </Section>

        <Section title="5. Data storage and security">
          Your data is stored securely on Supabase infrastructure hosted in the European Union. Supabase
          implements industry-standard security measures including encryption in transit (TLS) and at rest.
          We do not store payment card details.
        </Section>

        <Section title="6. Data sharing">
          We do not sell, rent, or trade your personal data. We may share data with:
          <ul className="list-disc list-inside mt-2 space-y-2 text-white/70">
            <li><strong className="text-white/90">Supabase</strong> — our hosting and database provider, acting as a data processor.</li>
            <li><strong className="text-white/90">Legal authorities</strong> — where required by law or court order.</li>
          </ul>
        </Section>

        <Section title="7. Data retention">
          We retain your account data for as long as your account is active. Game history records are
          retained for 12 months. You may request deletion of your account and associated data at any time.
        </Section>

        <Section title="8. Your rights">
          Under UK GDPR you have the right to:
          <ul className="list-disc list-inside mt-2 space-y-2 text-white/70">
            <li><strong className="text-white/90">Access</strong> — request a copy of the personal data we hold about you.</li>
            <li><strong className="text-white/90">Rectification</strong> — ask us to correct inaccurate data.</li>
            <li><strong className="text-white/90">Erasure</strong> — ask us to delete your personal data (&ldquo;right to be forgotten&rdquo;).</li>
            <li><strong className="text-white/90">Restriction</strong> — ask us to limit how we use your data.</li>
            <li><strong className="text-white/90">Portability</strong> — receive your data in a structured, machine-readable format.</li>
            <li><strong className="text-white/90">Objection</strong> — object to processing based on legitimate interests.</li>
          </ul>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:privacy@mathbattlearena.com" className="text-purple-400 hover:text-purple-300 transition">
            privacy@mathbattlearena.com
          </a>. We will respond within 30 days.
        </Section>

        <Section title="9. Cookies">
          For information on how we use cookies, see our{' '}
          <Link href="/legal/cookies" className="text-purple-400 hover:text-purple-300 transition">
            Cookies Policy
          </Link>.
        </Section>

        <Section title="10. Changes to this policy">
          We may update this Data Protection policy from time to time. Any material changes will be
          communicated via a notice on the Service. Continued use after changes constitutes acceptance.
        </Section>

        <Section title="11. Complaints">
          If you believe we have not handled your data correctly, you have the right to lodge a complaint
          with the UK Information Commissioner&apos;s Office (ICO) at{' '}
          <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition">
            ico.org.uk
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
      <Link href="/legal/cookies" className="hover:text-white/60 transition">Cookies Policy</Link>
      <Link href="/legal/terms"   className="hover:text-white/60 transition">Terms &amp; Conditions</Link>
    </div>
  )
}
