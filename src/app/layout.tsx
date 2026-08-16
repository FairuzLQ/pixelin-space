import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Space_Mono } from 'next/font/google'
import EasterEggs from '@/components/EasterEggs'
import './globals.css'

const sans = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
})

const SITE = 'https://pixelin.space'
const DESCRIPTION =
  'pixelin.space is a tiny anonymous social space — pick a nickname (no account, no email), post, react, comment, and DM. Everything resets every week.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'pixelin.space — a tiny anonymous space',
    template: '%s · pixelin.space',
  },
  description: DESCRIPTION,
  applicationName: 'pixelin',
  manifest: '/manifest.webmanifest',
  keywords: [
    'pixelin', 'pixelin.space', 'anonymous social', 'anonymous chat',
    'no account social', 'weekly reset', 'anonymous posting', 'anon dm',
  ],
  alternates: { canonical: '/' },
  category: 'social',
  // favicon/apple-icon are provided by the app/icon.svg convention
  verification: {
    google: 'YrMn2CRJpyMT2EsXgQ-XJLY9-NZwNPvQSdUTVCGbrzA',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'pixelin.space',
    title: 'pixelin.space — a tiny anonymous space',
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pixelin.space — a tiny anonymous space',
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: '#f2ecdd',
  colorScheme: 'light',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'pixelin.space',
  alternateName: 'pixelin',
  url: SITE,
  description: DESCRIPTION,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // own static data — safe to inline
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EasterEggs />
        {children}
      </body>
    </html>
  )
}
