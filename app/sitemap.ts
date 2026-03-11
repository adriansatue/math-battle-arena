import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mathbattlearena.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    {
      url:              SITE_URL,
      lastModified:     now,
      changeFrequency:  'monthly',
      priority:         1,
    },
    {
      url:              `${SITE_URL}/lobby`,
      lastModified:     now,
      changeFrequency:  'monthly',
      priority:         0.9,
    },
    {
      url:              `${SITE_URL}/practice`,
      lastModified:     now,
      changeFrequency:  'monthly',
      priority:         0.8,
    },
    {
      url:              `${SITE_URL}/leaderboard`,
      lastModified:     now,
      changeFrequency:  'daily',
      priority:         0.7,
    },
    {
      url:              `${SITE_URL}/rewards`,
      lastModified:     now,
      changeFrequency:  'monthly',
      priority:         0.6,
    },
    {
      url:              `${SITE_URL}/legal/cookies`,
      lastModified:     now,
      changeFrequency:  'yearly',
      priority:         0.2,
    },
    {
      url:              `${SITE_URL}/legal/terms`,
      lastModified:     now,
      changeFrequency:  'yearly',
      priority:         0.2,
    },
    {
      url:              `${SITE_URL}/legal/data-protection`,
      lastModified:     now,
      changeFrequency:  'yearly',
      priority:         0.2,
    },
  ]
}
