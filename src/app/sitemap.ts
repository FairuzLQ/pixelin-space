import type { MetadataRoute } from 'next'

// Only stable pages belong here — posts/tags reset weekly, so listing them
// would just create soft-404s in Google's index.
const SITE = 'https://pixelin.space'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]
}
