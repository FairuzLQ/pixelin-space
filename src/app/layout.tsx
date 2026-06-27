import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'pixelin.space',
  description: 'a small space for you and your people',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'pixelin.space',
    description: 'a small space for you and your people',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
