import type { Metadata } from 'next'

// Never index the admin panel.
export const metadata: Metadata = {
  title: 'admin',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
