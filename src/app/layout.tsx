import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Space_Mono } from 'next/font/google'
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'pixelin.space',
    template: '%s · pixelin.space',
  },
  description: 'a tiny anonymous space. pick a nickname, post, react, dm. resets every week.',
  applicationName: 'pixelin',
  manifest: '/manifest.webmanifest',
  // favicon/apple-icon are provided by app/icon.svg + app/apple-icon.svg conventions
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'pixelin.space',
    title: 'pixelin.space',
    description: 'a tiny anonymous space. resets every week.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pixelin.space',
    description: 'a tiny anonymous space. resets every week.',
  },
}

export const viewport: Viewport = {
  themeColor: '#f4efe3',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
