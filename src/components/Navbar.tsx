'use client'

import { useState, useEffect, useRef } from 'react'
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
  const starTaps = useRef<number[]>([])

  // tap the ✷ five times fast → confetti of stars (doesn't navigate)
  function tapStar(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const now = Date.now()
    starTaps.current = [...starTaps.current.filter(t => now - t < 1500), now]
    if (starTaps.current.length >= 5) {
      starTaps.current = []
      window.dispatchEvent(new Event('pixelin:egg'))
    }
  }

  useEffect(() => {
    setNickname(getNickname())
    const handler = () => setNickname(getNickname())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  useEffect(() => {
    if (pathname.startsWith('/dm')) {
      localStorage.setItem(DM_SEEN_KEY, Date.now().toString())
      setHasUnread(false)
    }
  }, [pathname])

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
          new Date(c.last_message_at).getTime() > lastSeen,
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

  const tab = (href: string, label: string, active: boolean, dot = false) => (
    <Link
      href={href}
      className="relative text-xs px-3 py-2 rounded-[10px] font-bold uppercase tracking-tight"
      style={{
        background: active ? 'var(--lime)' : 'transparent',
        border: `2.5px solid ${active ? 'var(--ink)' : 'transparent'}`,
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        color: 'var(--ink)',
      }}
    >
      {label}
      {dot && (
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
          style={{ background: 'var(--accent)', border: '2px solid var(--ink)' }}
        />
      )}
    </Link>
  )

  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between px-3 sm:px-4 py-2.5"
      style={{ background: 'var(--bg)', borderBottom: '2.5px solid var(--ink)' }}
    >
      <Link href="/" className="flex items-center gap-1.5 shrink-0" aria-label="pixelin.space">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-sm"
          style={{ background: 'var(--accent)', border: '2.5px solid var(--ink)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}
          onClick={tapStar}
          role="presentation"
        >
          ✷
        </span>
        <span className="display text-lg leading-none hidden xs:inline" style={{ color: 'var(--ink)' }}>pixelin</span>
      </Link>

      <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
        {tab('/', 'feed', pathname === '/')}
        {tab('/saved', 'saved', pathname === '/saved')}
        {tab('/dm', 'dm', pathname.startsWith('/dm'), hasUnread && !pathname.startsWith('/dm'))}
        {nickname && (
          <span
            className="mono text-xs px-2 py-1.5 rounded-md max-w-[80px] sm:max-w-[120px] truncate ml-1"
            style={{ color: 'var(--ink)', background: 'var(--bg3)', border: '2px solid var(--ink)' }}
            title={`@${nickname}`}
          >
            @{nickname}
          </span>
        )}
      </div>
    </nav>
  )
}
