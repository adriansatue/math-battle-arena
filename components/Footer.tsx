import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-black/20 backdrop-blur-sm pb-20 sm:pb-0">
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-white/30 text-xs">
          Copyright {new Date().getFullYear()} Math Battle Arena. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center">
          <FooterLink href="/how-it-works">How It Works</FooterLink>
          <FooterLink href="/legal/cookies">Cookies Policy</FooterLink>
          <FooterLink href="/legal/terms">Terms &amp; Conditions</FooterLink>
          <FooterLink href="/legal/data-protection">Data Protection</FooterLink>
        </nav>
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="border-l border-white/10 px-3 text-xs text-white/40 transition first:border-l-0 hover:text-white/70"
    >
      {children}
    </Link>
  )
}
