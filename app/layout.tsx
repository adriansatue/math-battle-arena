import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import NavBar  from '@/components/NavBar'
import Footer  from '@/components/Footer'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mathbattlearena.vercel.app'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  // Title template: leaf pages override the first part
  title: {
    default:  'Math Battle Arena',
    template: '%s | Math Battle Arena',
  },

  description:
    'Challenge real players or AI bots in fast-paced maths duels. Earn cards, climb the leaderboard and become the ultimate Math Champion. Free to play!',

  keywords: [
    'math battle', 'maths game', 'multiplayer maths', 'math quiz', 'math duels',
    'educational game', 'times tables', 'mental maths', 'kids maths game', 'school maths',
  ],

  authors:     [{ name: 'Math Battle Arena' }],
  creator:     'Math Battle Arena',
  publisher:   'Math Battle Arena',
  applicationName: 'Math Battle Arena',

  manifest: '/manifest.json',
  icons: {
    apple: '/icon-192.png',
    icon:  '/icon-192.png',
  },

  // Canonical & alternate
  alternates: { canonical: '/' },

  // Robots
  robots: {
    index:        true,
    follow:       true,
    googleBot: {
      index:               true,
      follow:              true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },

  // Open Graph
  openGraph: {
    type:        'website',
    locale:      'en_GB',
    url:          SITE_URL,
    siteName:    'Math Battle Arena',
    title:       'Math Battle Arena — Multiplayer Maths Duels',
    description:
      'Challenge real players or AI bots in fast-paced maths duels. Earn cards, climb the leaderboard and become the ultimate Math Champion.',
    images: [
      {
        url:    '/og-image.png',
        width:  1200,
        height: 630,
        alt:    'Math Battle Arena — Multiplayer Maths Duels',
      },
    ],
  },

  // Twitter / X
  twitter: {
    card:        'summary_large_image',
    title:       'Math Battle Arena — Multiplayer Maths Duels',
    description: 'Challenge real players or AI bots in fast-paced maths duels. Free to play!',
    images:      ['/og-image.png'],
  },
}

// JSON-LD structured data (WebApplication schema)
const jsonLd = {
  '@context':       'https://schema.org',
  '@type':          'WebApplication',
  name:             'Math Battle Arena',
  url:               SITE_URL,
  description:      'Multiplayer maths duels — challenge real players or AI bots, earn cards, and climb the leaderboard.',
  applicationCategory: 'EducationalApplication',
  genre:            'Education',
  operatingSystem:  'Any',
  browserRequirements: 'Requires JavaScript',
  offers: {
    '@type': 'Offer',
    price:   '0',
    priceCurrency: 'GBP',
  },
  audience: {
    '@type':     'EducationalAudience',
    educationalRole: 'student',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NavBar />
        {children}
        <Footer />
        {/* Mobile bottom nav spacer */}
        <div className="sm:hidden h-16" />
      </body>
    </html>
  )
}