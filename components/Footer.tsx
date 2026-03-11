import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-black/20 backdrop-blur-sm pb-20 sm:pb-0">
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-white/30 text-xs">
          © {new Date().getFullYear()} Math Battle Arena. All rights reserved.
        </p>
        <nav className="flex items-center gap-4">
          <Link href="/legal/cookies"         className="text-white/40 hover:text-white/70 text-xs transition">Cookies Policy</Link>
          <span className="text-white/20 text-xs">·</span>
          <Link href="/legal/terms"           className="text-white/40 hover:text-white/70 text-xs transition">Terms &amp; Conditions</Link>
          <span className="text-white/20 text-xs">·</span>
          <Link href="/legal/data-protection" className="text-white/40 hover:text-white/70 text-xs transition">Data Protection</Link>
        </nav>
      </div>
    </footer>
  )
}
