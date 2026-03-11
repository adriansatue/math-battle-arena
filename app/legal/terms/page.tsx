import Link from 'next/link'

export const metadata = {
  title: 'Terms & Conditions – Math Battle Arena',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="space-y-2">
          <Link href="/lobby" className="text-purple-400 hover:text-purple-300 text-sm transition">← Back</Link>
          <h1 className="text-3xl font-black text-white">📜 Terms &amp; Conditions</h1>
          <p className="text-white/40 text-sm">Last updated: March 2026</p>
        </div>

        <Section title="1. Acceptance of terms">
          By accessing or using Math Battle Arena (&ldquo;the Service&rdquo;), you agree to be bound by these Terms
          and Conditions. If you do not agree, please do not use the Service.
        </Section>

        <Section title="2. Eligibility">
          The Service is intended for users of all ages, but accounts for users under 13 must be created
          and supervised by a parent or guardian. By creating an account you confirm that either you are
          13 or older, or you have parental consent.
        </Section>

        <Section title="3. User accounts">
          <ul className="list-disc list-inside space-y-2 text-white/70">
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must not create accounts using false identities or impersonate others.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
          </ul>
        </Section>

        <Section title="4. Acceptable use">
          You agree not to:
          <ul className="list-disc list-inside mt-2 space-y-2 text-white/70">
            <li>Use the Service for any unlawful purpose.</li>
            <li>Attempt to cheat, exploit bugs, or gain unfair advantages in battles.</li>
            <li>Interfere with the normal operation of the Service or its servers.</li>
            <li>Harass, threaten, or abuse other users.</li>
            <li>Reverse-engineer or attempt to extract source code from the Service.</li>
          </ul>
        </Section>

        <Section title="5. Virtual items and rewards">
          Cards, points, and other in-game rewards have no real-world monetary value and cannot be
          exchanged for cash, goods, or services outside the Service. We reserve the right to modify,
          rebalance, or remove virtual items at any time without compensation.
        </Section>

        <Section title="6. Intellectual property">
          All content within Math Battle Arena, including but not limited to graphics, text, card designs,
          and game mechanics, is owned by or licensed to us. You may not reproduce or distribute any
          part of the Service without prior written permission.
        </Section>

        <Section title="7. Disclaimers">
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee that the
          Service will be uninterrupted, error-free, or free of harmful components. Use the Service at
          your own risk.
        </Section>

        <Section title="8. Limitation of liability">
          To the maximum extent permitted by law, we shall not be liable for any indirect, incidental,
          special, or consequential damages arising out of your use of the Service.
        </Section>

        <Section title="9. Changes to these terms">
          We may update these Terms from time to time. Continued use of the Service after any changes
          constitutes your acceptance of the new terms.
        </Section>

        <Section title="10. Contact">
          Questions about these Terms should be directed to{' '}
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
      <Link href="/legal/cookies"         className="hover:text-white/60 transition">Cookies Policy</Link>
      <Link href="/legal/data-protection" className="hover:text-white/60 transition">Data Protection</Link>
    </div>
  )
}
