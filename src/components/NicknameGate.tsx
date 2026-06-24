'use client'

import { useState, useEffect } from 'react'
import { getNickname, setNickname } from '@/lib/fingerprint'

export default function NicknameGate({ children }: { children: React.ReactNode }) {
  const [nickname, setLocalNickname] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLocalNickname(getNickname())
    setLoading(false)
  }, [])

  function save() {
    const trimmed = input.trim()
    if (!trimmed || trimmed.length < 2) return
    setNickname(trimmed)
    setLocalNickname(trimmed)
  }

  if (loading) return null

  if (!nickname) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,7,15,0.96)' }}>
        <div className="card p-8 w-full max-w-sm flex flex-col gap-5">
          <div className="text-center">
            <div className="text-3xl mb-2">✦</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>welcome to pixelin.space</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>pick a nickname to enter. no account needed.</p>
          </div>
          <input
            className="w-full px-4 py-3 text-sm"
            placeholder="your nickname..."
            maxLength={24}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            autoFocus
          />
          <button
            className="btn-primary w-full py-3 text-sm"
            onClick={save}
            disabled={input.trim().length < 2}
          >
            enter the space →
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
