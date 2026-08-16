import type { MetadataRoute } from 'next'

// Only the homepage is stable and worth indexing — posts/tags reset weekly, so
// listing them would just create soft-404s in Google's index.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://pixelin.space',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
  ]
}
