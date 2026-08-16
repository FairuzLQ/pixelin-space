'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getNickname, setNickname, getFingerprint } from '@/lib/fingerprint'
import { starRain, partyRain, flashToast } from '@/components/EasterEggs'

// legendary nicknames → a little welcome surprise
const SPECIAL_NICKS: Record<string, { msg: string; fx: () => void }> = {
  '42': { msg: '42 — the answer ✷', fx: starRain },
  neo: { msg: 'wake up… follow the white rabbit 🐇', fx: starRain },
  glitch: { msg: 'g l i t c h in the space', fx: partyRain },
  pixel: { msg: 'pixel perfect ✷', fx: starRain },
  konami: { msg: '↑↑↓↓←→←→ B A', fx: starRain },
  star: { msg: 'a star is born ✷', fx: starRain },
  party: { msg: 'let\'s gooo 🎉', fx: partyRain },
  ghost: { msg: 'boo 👻', fx: starRain },
}

export default function NicknameGate({ children }: { children: React.ReactNode }) {
  const [nickname, setLocalNickname] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/announcement')
      .then(r => r.json())
      .then(d => {
        if (d.session_reset_at) {
          const lastReset = localStorage.getItem('ps_last_reset')
          const serverReset = new Date(d.session_reset_at).getTime()
          const clientReset = lastReset ? new Date(lastReset).getTime() : 0

          if (serverReset > clientReset) {
            // admin triggered reset — wipe all session data
            Object.keys(localStorage)
              .filter(k => k.startsWith('ps_'))
              .forEach(k => localStorage.removeItem(k))
            localStorage.setItem('ps_last_reset', d.session_reset_at)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setLocalNickname(getNickname())
        setLoading(false)
      })
  }, [])

  async function save() {
    const trimmed = input.trim()
    if (!trimmed || checking) return
    if (!/^[A-Za-z0-9_.]{2,20}$/.test(trimmed)) {
      setError('2–20 chars, only letters, numbers, _ and .')
      return
    }

    setChecking(true)
    setError(null)

    const fp = getFingerprint()
    const res = await fetch('/api/nickname/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: trimmed, fingerprint: fp }),
    })

    if (res.status === 409) {
      setError('taken this week — try another one')
      setChecking(false)
      return
    }
    if (res.status === 429) {
      setError('too many tries, slow down a sec')
      setChecking(false)
      return
    }
    if (!res.ok) {
      setError('that nickname isn\'t allowed, try another')
      setChecking(false)
      return
    }

    setNickname(trimmed)
    setLocalNickname(trimmed)
    setChecking(false)

    // legendary nickname? fire a surprise once the feed is showing
    const special = SPECIAL_NICKS[trimmed.toLowerCase()]
    if (special) setTimeout(() => { special.fx(); flashToast(special.msg) }, 450)
  }

  if (loading) return null

  if (!nickname) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'var(--bg)', backgroundImage: 'radial-gradient(var(--ink) 0.6px, transparent 0.6px)', backgroundSize: '22px 22px' }}
      >
        <div className="card p-6 sm:p-8 w-full max-w-sm flex flex-col gap-5">
          <div className="text-center">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl mb-3"
              style={{ background: 'var(--accent)', border: '2.5px solid var(--ink)', boxShadow: 'var(--shadow-sm)' }}
              aria-hidden
            >
              ✷
            </div>
            <h1 className="display text-2xl" style={{ color: 'var(--ink)' }}>pixelin.space</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--text2)' }}>
              pick a nickname to enter. no account, no email, no fuss.
            </p>
            <p
              className="text-xs mt-3 px-2 py-1.5 rounded-lg inline-block font-bold"
              style={{ background: 'var(--lime)', color: 'var(--ink)', border: '2px solid var(--ink)' }}
            >
              ✷ everything resets every week
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <input
              className="w-full px-4 py-3 mono"
              placeholder="your_nickname"
              maxLength={20}
              value={input}
              onChange={e => { setInput(e.target.value); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && save()}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="nickname"
            />
            <p className="text-xs px-1" style={{ color: error ? 'var(--accent)' : 'var(--text2)' }}>
              {error ?? '2–20 chars · letters, numbers, _ and . only'}
            </p>
          </div>

          <button
            className="btn-primary w-full py-3 text-sm"
            onClick={save}
            disabled={input.trim().length < 2 || checking}
          >
            {checking ? 'checking...' : 'enter →'}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text2)' }}>
            a nickname is yours for 7 days, then it&apos;s up for grabs again.
          </p>
          <p className="text-xs text-center" style={{ color: 'var(--text2)' }}>
            by entering you agree to the{' '}
            <Link href="/about" className="linkified">rules</Link> &amp;{' '}
            <Link href="/privacy" className="linkified">privacy</Link>.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
