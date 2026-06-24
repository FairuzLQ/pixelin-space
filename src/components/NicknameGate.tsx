'use client'

import { useState, useEffect } from 'react'
import { getNickname, setNickname, getFingerprint } from '@/lib/fingerprint'

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
    if (!trimmed || trimmed.length < 2 || checking) return

    setChecking(true)
    setError(null)

    const fp = getFingerprint()
    const res = await fetch('/api/nickname/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: trimmed, fingerprint: fp }),
    })

    if (res.status === 409) {
      setError('username ini sudah dipakai orang lain minggu ini, coba yang lain')
      setChecking(false)
      return
    }

    if (!res.ok) {
      setError('gagal cek username, coba lagi')
      setChecking(false)
      return
    }

    setNickname(trimmed)
    setLocalNickname(trimmed)
    setChecking(false)
  }

  if (loading) return null

  if (!nickname) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,7,15,0.97)' }}>
        <div className="card p-6 sm:p-8 w-full max-w-sm flex flex-col gap-5">
          <div className="text-center">
            <div className="text-3xl mb-2">✦</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>welcome to pixelin.space</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              pick a nickname to enter. no account needed.
            </p>
            <p className="text-xs mt-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(124,106,247,0.1)', color: 'var(--accent2)' }}>
              username & posts reset every week ✦
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <input
              className="w-full px-4 py-3"
              placeholder="your nickname..."
              maxLength={24}
              value={input}
              onChange={e => { setInput(e.target.value); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && save()}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {error && (
              <p className="text-xs px-1" style={{ color: '#f87171' }}>{error}</p>
            )}
          </div>

          <button
            className="btn-primary w-full py-3 text-sm"
            onClick={save}
            disabled={input.trim().length < 2 || checking}
          >
            {checking ? 'checking...' : 'enter the space →'}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text2)' }}>
            username hanya berlaku 7 hari, lalu bisa dipakai siapa saja
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
