import type { Category } from '@/lib/game/questions'

type Props = {
  level: number
  category: Category
  className?: string
  locked?: boolean
}

const PALETTES: Record<Category, { background: string; shell: string; accent: string }> = {
  addition: { background: '#4c1d95', shell: '#c4b5fd', accent: '#f9a8d4' },
  subtraction: { background: '#831843', shell: '#f9a8d4', accent: '#fde68a' },
  multiplication: { background: '#312e81', shell: '#a5b4fc', accent: '#f0abfc' },
  division: { background: '#164e63', shell: '#a5f3fc', accent: '#c4b5fd' },
  fractions: { background: '#78350f', shell: '#fde68a', accent: '#f9a8d4' },
  order_of_ops: { background: '#581c87', shell: '#e9d5ff', accent: '#67e8f9' },
}

const CATEGORY_SYMBOLS: Record<Category, string> = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
  fractions: '½',
  order_of_ops: '( )',
}

export function BotPortrait({ level, category, className = '', locked = false }: Props) {
  const palette = PALETTES[category]
  const eyeStyle = level % 5
  const antennaStyle = level % 4
  const headStyle = level % 3
  const mouthStyle = level % 5
  const accessoryStyle = level % 6

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={`Bot level ${level} character portrait`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="120" height="120" rx="18" fill={locked ? '#272136' : palette.background} />
      <circle cx="18" cy="20" r="22" fill="white" opacity="0.07" />
      <circle cx="105" cy="94" r="34" fill="white" opacity="0.06" />
      <text x="103" y="29" textAnchor="middle" fill="white" fontSize={category === 'order_of_ops' ? 16 : 25} fontWeight="900" opacity="0.18">{CATEGORY_SYMBOLS[category]}</text>

      {antennaStyle === 0 && <path d="M60 28V14M52 14h16" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />}
      {antennaStyle === 1 && <><path d="M60 28 49 14" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" /><circle cx="47" cy="12" r="5" fill={palette.accent} /></>}
      {antennaStyle === 2 && <><path d="M52 29 43 16M68 29l9-13" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" /><circle cx="42" cy="14" r="4" fill={palette.accent} /><circle cx="78" cy="14" r="4" fill={palette.accent} /></>}
      {antennaStyle === 3 && <path d="M47 27c0-13 26-13 26 0" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />}

      {accessoryStyle === 0 && <g className="origin-center transition-transform group-hover:-rotate-6"><path d="m39 32 4-18 16 10 15-13 7 21z" fill="#fde68a" stroke="#f59e0b" strokeWidth="2" /><circle cx="44" cy="14" r="3" fill="#f9a8d4" /><circle cx="74" cy="11" r="3" fill="#67e8f9" /></g>}
      {accessoryStyle === 1 && <g><path d="M20 58c0-25 15-37 40-37s40 12 40 37" fill="none" stroke="#171020" strokeWidth="7" /><rect x="15" y="48" width="13" height="25" rx="6" fill={palette.accent} /><rect x="92" y="48" width="13" height="25" rx="6" fill={palette.accent} /></g>}
      {accessoryStyle === 2 && <g className="origin-center transition-transform group-hover:rotate-6"><path d="m24 42-13-9 5 19zM96 42l13-9-5 19z" fill={palette.accent} stroke="white" strokeOpacity="0.45" strokeWidth="2" /></g>}
      {accessoryStyle === 3 && <g><path d="M30 46h60v21H30z" fill="#171020" opacity="0.88" /><path d="M35 51h50" stroke={palette.accent} strokeWidth="4" strokeLinecap="round" /></g>}
      {accessoryStyle === 4 && <g className="origin-center transition-transform group-hover:rotate-12"><path d="M60 28V15" stroke="#171020" strokeWidth="4" /><path d="M38 14h44M60 14 45 5M60 14 75 5" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" /></g>}
      {accessoryStyle === 5 && <g><path d="M35 34c2-13 48-13 50 0" fill="#171020" /><path d="M37 31h46" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" /><path d="M84 31h17" stroke="#171020" strokeWidth="5" strokeLinecap="round" /></g>}

      <path d="M27 105c3-18 16-27 33-27s30 9 33 27" fill={locked ? '#514861' : palette.accent} opacity="0.85" />
      {headStyle === 0 && <rect x="24" y="29" width="72" height="59" rx="12" fill={locked ? '#665d70' : palette.shell} stroke="white" strokeOpacity="0.45" strokeWidth="2" />}
      {headStyle === 1 && <path d="M35 29h50l12 15-5 40-32 7-32-7-5-40z" fill={locked ? '#665d70' : palette.shell} stroke="white" strokeOpacity="0.45" strokeWidth="2" />}
      {headStyle === 2 && <rect x="24" y="29" width="72" height="59" rx="27" fill={locked ? '#665d70' : palette.shell} stroke="white" strokeOpacity="0.45" strokeWidth="2" />}
      <rect x="18" y="45" width="9" height="26" rx="4" fill={locked ? '#514861' : palette.accent} />
      <rect x="93" y="45" width="9" height="26" rx="4" fill={locked ? '#514861' : palette.accent} />

      {eyeStyle === 0 && <><circle cx="44" cy="55" r="7" fill="#171020" /><circle cx="76" cy="55" r="7" fill="#171020" /><circle cx="42" cy="52" r="2" fill="white" /><circle cx="74" cy="52" r="2" fill="white" /></>}
      {eyeStyle === 1 && <><rect x="36" y="49" width="17" height="11" rx="5" fill="#171020" /><rect x="67" y="49" width="17" height="11" rx="5" fill="#171020" /><path d="m39 53 10 3M70 56l10-3" stroke="white" strokeOpacity="0.65" strokeWidth="2" /></>}
      {eyeStyle === 2 && <><path d="m36 55 8-6 8 6-8 6zM68 55l8-6 8 6-8 6z" fill="#171020" /><circle cx="44" cy="55" r="2" fill="white" /><circle cx="76" cy="55" r="2" fill="white" /></>}
      {eyeStyle === 3 && <><path d="M36 55q8-9 16 0" fill="none" stroke="#171020" strokeWidth="5" strokeLinecap="round" /><circle cx="76" cy="54" r="8" fill="#171020" /><circle cx="73" cy="51" r="2.5" fill="white" /></>}
      {eyeStyle === 4 && <><rect x="37" y="48" width="46" height="15" rx="7" fill="#171020" /><circle cx="60" cy="55.5" r="5" fill={palette.accent} /><circle cx="58" cy="53" r="1.5" fill="white" /></>}

      <circle cx="34" cy="68" r="4" fill="#fb7185" opacity="0.45" />
      <circle cx="86" cy="68" r="4" fill="#fb7185" opacity="0.45" />
      {mouthStyle === 0 && <path d="M45 70q15 16 30 0" fill="#171020" stroke="#171020" strokeWidth="3" strokeLinecap="round" />}
      {mouthStyle === 1 && <g><rect x="43" y="69" width="34" height="13" rx="5" fill="#171020" /><path d="M48 70v6h8v-6M64 70v6h8v-6" fill="white" stroke="white" strokeWidth="2" /></g>}
      {mouthStyle === 2 && <g><circle cx="60" cy="75" r="9" fill="#171020" /><ellipse cx="60" cy="80" rx="5" ry="3" fill="#fb7185" /></g>}
      {mouthStyle === 3 && <path d="M44 76q8-10 16 0 8-10 16 0" fill="none" stroke="#171020" strokeWidth="5" strokeLinecap="round" />}
      {mouthStyle === 4 && <g><path d="M45 70h30q-3 15-15 15T45 70" fill="#171020" /><path d="M53 82q7-6 14 0" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" /></g>}
      <path d="M50 91h20l-3 9H53z" fill={locked ? '#312b3b' : palette.background} stroke="white" strokeOpacity="0.25" />
      <circle cx="60" cy="95" r="2.5" fill={palette.accent} />

      {level % 2 === 0
        ? <path d="M30 92 14 80M90 92l16-12" stroke={palette.accent} strokeWidth="7" strokeLinecap="round" />
        : <path d="M29 94 14 102M91 94l15 8" stroke={palette.accent} strokeWidth="7" strokeLinecap="round" />}

      <rect x="8" y="8" width="28" height="21" rx="8" fill="#171020" fillOpacity="0.88" />
      <text x="22" y="23" textAnchor="middle" fill="white" fontSize="12" fontWeight="900">{level}</text>

      {locked && <><rect width="120" height="120" rx="18" fill="#171020" opacity="0.48" /><path d="M52 59v-5a8 8 0 0 1 16 0v5M48 59h24v20H48z" fill="#ddd6fe" opacity="0.88" /></>}
    </svg>
  )
}