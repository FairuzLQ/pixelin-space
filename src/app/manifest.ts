import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'pixelin.space',
    short_name: 'pixelin',
    description: 'a tiny anonymous space. pick a nickname, post, react, dm. resets every week.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f2ecdd',
    theme_color: '#f2ecdd',
    categories: ['social'],
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
