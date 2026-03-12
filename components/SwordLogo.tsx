interface SwordLogoProps {
  // px size — overridden by Tailwind w-/h- classes if provided
  size?: number
  className?: string
  // Unique prefix for gradient/filter IDs when rendered multiple times on a page
  id?: string
}

/**
 * Custom crossed-swords logo — kid-friendly, purple/gold palette.
 * Two cartoon swords form an ✕ with a gold star sparkle at the crossing.
 */
export function SwordLogo({ size = 40, className = '', id = 'mba' }: SwordLogoProps) {
  // IDs for SVG defs
  const blade = `${id}-blade`
  const gold  = `${id}-gold`
  const glow  = `${id}-glow`
  const drop  = `${id}-drop`

  // Both swords are drawn pointing straight up, then rotated ±45° around (60, 50).
  // (60, 50) is the crossing point — roughly the upper-middle of the blades.
  // Sword 1 → +45°: tip top-right,  pommel bottom-left
  // Sword 2 → −45°: tip top-left,   pommel bottom-right

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Blade: bright white at tip → soft lavender → deep purple near guard */}
        <linearGradient id={blade} x1="60" y1="15" x2="60" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#f8fafc" />
          <stop offset="55%"  stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>

        {/* Gold for guard & pommel */}
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#fde68a" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* Soft glow for the centre sparkle */}
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Subtle indigo drop-shadow on each sword */}
        <filter id={drop} x="-15%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#1e1b4b" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* ── Sword 2 first (behind) — tip top-left, pommel bottom-right ── */}
      <g transform="rotate(-45, 60, 50)" filter={`url(#${drop})`}>
        {/* Blade — kite shape, wider at guard */}
        <path
          d="M60 15 L66 83 L60 90 L54 83 Z"
          fill={`url(#${blade})`}
          stroke="#5b21b6" strokeWidth="1.3" strokeLinejoin="round"
        />
        {/* Highlight streak down the blade */}
        <line x1="59" y1="20" x2="56.5" y2="78"
          stroke="white" strokeWidth="1.6" strokeOpacity="0.38" strokeLinecap="round" />
        {/* Guard — pill shape */}
        <rect x="43" y="88" width="34" height="9" rx="4.5"
          fill={`url(#${gold})`} stroke="#92400e" strokeWidth="1.2" />
        {/* Grip — rounded rect, dark purple */}
        <rect x="56.5" y="97" width="7" height="17" rx="3"
          fill="#3b0764" stroke="#7c3aed" strokeWidth="0.9" />
        {/* Grip wraps */}
        <line x1="56.5" y1="102" x2="63.5" y2="102" stroke="#a78bfa" strokeWidth="0.8" />
        <line x1="56.5" y1="107" x2="63.5" y2="107" stroke="#a78bfa" strokeWidth="0.8" />
        <line x1="56.5" y1="112" x2="63.5" y2="112" stroke="#a78bfa" strokeWidth="0.8" />
        {/* Pommel */}
        <circle cx="60" cy="119" r="6"
          fill={`url(#${gold})`} stroke="#92400e" strokeWidth="1.2" />
        <circle cx="58.5" cy="117.5" r="2" fill="white" opacity="0.4" />
      </g>

      {/* ── Sword 1 (on top) — tip top-right, pommel bottom-left ── */}
      <g transform="rotate(45, 60, 50)" filter={`url(#${drop})`}>
        {/* Blade */}
        <path
          d="M60 15 L66 83 L60 90 L54 83 Z"
          fill={`url(#${blade})`}
          stroke="#5b21b6" strokeWidth="1.3" strokeLinejoin="round"
        />
        <line x1="59" y1="20" x2="56.5" y2="78"
          stroke="white" strokeWidth="1.6" strokeOpacity="0.38" strokeLinecap="round" />
        {/* Guard */}
        <rect x="43" y="88" width="34" height="9" rx="4.5"
          fill={`url(#${gold})`} stroke="#92400e" strokeWidth="1.2" />
        {/* Grip */}
        <rect x="56.5" y="97" width="7" height="17" rx="3"
          fill="#3b0764" stroke="#7c3aed" strokeWidth="0.9" />
        <line x1="56.5" y1="102" x2="63.5" y2="102" stroke="#a78bfa" strokeWidth="0.8" />
        <line x1="56.5" y1="107" x2="63.5" y2="107" stroke="#a78bfa" strokeWidth="0.8" />
        <line x1="56.5" y1="112" x2="63.5" y2="112" stroke="#a78bfa" strokeWidth="0.8" />
        {/* Pommel */}
        <circle cx="60" cy="119" r="6"
          fill={`url(#${gold})`} stroke="#92400e" strokeWidth="1.2" />
        <circle cx="58.5" cy="117.5" r="2" fill="white" opacity="0.4" />
      </g>

      {/* ── 4-point star sparkle at the crossing (60, 50) ── */}
      <g transform="translate(60, 50)" filter={`url(#${glow})`}>
        {/* Outer white petals */}
        <path
          d="M0,-11 L2.5,-2.5 L11,0 L2.5,2.5 L0,11 L-2.5,2.5 L-11,0 L-2.5,-2.5 Z"
          fill="white" opacity="0.95"
        />
        {/* Inner gold centre */}
        <path
          d="M0,-6 L1.4,-1.4 L6,0 L1.4,1.4 L0,6 L-1.4,1.4 L-6,0 L-1.4,-1.4 Z"
          fill="#fde68a"
        />
      </g>

      {/* ── Small corner sparkles (top-left & top-right) ── */}
      <path
        d="M22,22 L23.5,18 L25,22 L29,23.5 L25,25 L23.5,29 L22,25 L18,23.5 Z"
        fill="#fde68a" opacity="0.8"
      />
      <path
        d="M98,22 L99.5,18 L101,22 L105,23.5 L101,25 L99.5,29 L98,25 L94,23.5 Z"
        fill="#fde68a" opacity="0.8"
      />
    </svg>
  )
}
