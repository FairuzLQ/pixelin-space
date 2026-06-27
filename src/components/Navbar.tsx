'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getNickname, getFingerprint } from '@/lib/fingerprint'

const DM_SEEN_KEY = 'ps_dm_last_seen'

function getLastSeen(): number {
  try { return parseInt(localStorage.getItem(DM_SEEN_KEY) ?? '0', 10) } catch { return 0 }
}

export default function Navbar() {
  const [nickname, setNickname] = useState<string | null>(null)
  const [hasUnread, setHasUnread] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setNickname(getNickname())
    const handler = () => setNickname(getNickname())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // mark DMs as seen when on /dm pages
  useEffect(() => {
    if (pathname.startsWith('/dm')) {
      localStorage.setItem(DM_SEEN_KEY, Date.now().toString())
      setHasUnread(false)
    }
  }, [pathname])

  // check for unread DMs every 30s
  useEffect(() => {
    async function check() {
      const fp = getFingerprint()
      const nick = getNickname()
      if (!fp || fp === 'server' || !nick) return

      try {
        const res = await fetch(`/api/dm?fingerprint=${fp}&nickname=${encodeURIComponent(nick)}`)
        const data = await res.json()
        const convs = data.conversations ?? []
        const lastSeen = getLastSeen()

        const hasNew = convs.some((c: { last_message_at: string }) =>
          new Date(c.last_message_at).getTime() > lastSeen
        )
        setHasUnread(hasNew)
      } catch { /* ignore */ }
    }

    if (!pathname.startsWith('/dm')) {
      check()
      const timer = setInterval(check, 30000)
      return () => clearInterval(timer)
    }
  }, [pathname])

  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between px-3 sm:px-4 py-3 border-b"
      style={{ background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
    >
      <Link href="/" className="flex items-center shrink-0" aria-label="pixelin.space">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="pixelin.space" height="28" style={{ height: 28, width: 'auto' }} />
      </Link>

      <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
        <Link
          href="/"
          className="btn-ghost text-xs px-2 sm:px-3 py-2"
          style={{ color: pathname === '/' ? 'var(--accent2)' : undefined }}
        >
          feed
        </Link>
        <Link
          href="/dm"
          className="btn-ghost text-xs px-2 sm:px-3 py-2 relative"
          style={{ color: pathname.startsWith('/dm') ? 'var(--accent2)' : undefined }}
        >
          dms
          {hasUnread && !pathname.startsWith('/dm') && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
          )}
        </Link>
        {nickname && (
          <span
            className="text-xs px-2 py-1.5 rounded-lg max-w-[80px] sm:max-w-[120px] truncate"
            style={{ color: 'var(--text2)', background: 'var(--bg3)' }}
            title={`@${nickname}`}
          >
            @{nickname}
          </span>
        )}
      </div>
    </nav>
  )
}
