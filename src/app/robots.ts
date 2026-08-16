import type { MetadataRoute } from 'next'

const SITE = 'https://pixelin.space'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // keep crawlers off private/ephemeral surfaces: the API, admin, DMs,
        // the local-only saved page, and individual weekly-expiring posts
        disallow: ['/api/', '/admin', '/dm', '/saved', '/p/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
