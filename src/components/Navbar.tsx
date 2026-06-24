'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getNickname } from '@/lib/fingerprint'

export default function Navbar() {
  const [nickname, setNickname] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    setNickname(getNickname())
    const handler = () => setNickname(getNickname())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b"
      style={{ background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
    >
      <Link href="/" className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--text)' }}>
        <span style={{ color: 'var(--accent)' }}>✦</span> pixelin.space
      </Link>

      <div className="flex items-center gap-1">
        <Link
          href="/"
          className="btn-ghost text-xs px-3 py-2"
          style={{ color: pathname === '/' ? 'var(--accent2)' : undefined }}
        >
          feed
        </Link>
        <Link
          href="/dm"
          className="btn-ghost text-xs px-3 py-2"
          style={{ color: pathname.startsWith('/dm') ? 'var(--accent2)' : undefined }}
        >
          dms
        </Link>
        {nickname && (
          <span className="text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--text2)' }}>
            @{nickname}
          </span>
        )}
      </div>
    </nav>
  )
}
