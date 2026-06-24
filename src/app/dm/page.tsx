'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import { getNickname, getFingerprint } from '@/lib/fingerprint'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface Conversation {
  id: string
  last_message_at: string
  participants: { nickname: string; fingerprint: string }[]
  last_message: { content: string; sender_nickname: string } | null
}

export default function DmPage() {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [invitee1, setInvitee1] = useState('')
  const [invitee2, setInvitee2] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const fp = getFingerprint()
    fetch(`/api/dm?fingerprint=${fp}`)
      .then(r => r.json())
      .then(d => {
        setConvs(d.conversations ?? [])
        setLoading(false)
      })
  }, [])

  async function createConv() {
    const nickname = getNickname()
    const fp = getFingerprint()
    const invitees = [invitee1.trim(), invitee2.trim()].filter(Boolean)
    if (!nickname || invitees.length === 0 || creating) return
    setCreating(true)

    const res = await fetch('/api/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviter_nickname: nickname,
        inviter_fingerprint: fp,
        invitee_nicknames: invitees,
      }),
    })
    const data = await res.json()
    if (data.conversation_id) {
      window.location.href = `/dm/${data.conversation_id}`
    }
    setCreating(false)
  }

  const myNickname = getNickname()

  return (
    <NicknameGate>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>direct messages</h1>
          <button className="btn-primary text-xs px-3 py-2" onClick={() => setShowNew(v => !v)}>
            + new dm
          </button>
        </div>

        {showNew && (
          <div className="card p-4 flex flex-col gap-3">
            <p className="text-xs" style={{ color: 'var(--text2)' }}>
              start a dm — add up to 2 people (nicknames). max 3 total.
            </p>
            <input
              className="w-full px-3 py-2 text-sm"
              placeholder="nickname 1..."
              value={invitee1}
              onChange={e => setInvitee1(e.target.value)}
            />
            <input
              className="w-full px-3 py-2 text-sm"
              placeholder="nickname 2 (optional)..."
              value={invitee2}
              onChange={e => setInvitee2(e.target.value)}
            />
            <button
              className="btn-primary text-xs px-4 py-2 self-end"
              onClick={createConv}
              disabled={creating || !invitee1.trim()}
            >
              {creating ? 'creating...' : 'start chat →'}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-xs" style={{ color: 'var(--text2)' }}>loading...</p>
        ) : convs.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text2)' }}>
            <div className="text-4xl mb-3">✉</div>
            <p className="text-sm">no dms yet. start one above.</p>
          </div>
        ) : (
          convs.map(conv => {
            const others = conv.participants.filter(p => p.nickname !== myNickname)
            const title = others.map(p => p.nickname).join(', ') || 'unknown'
            return (
              <Link key={conv.id} href={`/dm/${conv.id}`} className="card p-4 flex items-center gap-3 cursor-pointer">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}
                >
                  {title.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{title}</span>
                    <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--text2)' }}>
                      {timeAgo(conv.last_message_at)}
                    </span>
                  </div>
                  {conv.last_message && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text2)' }}>
                      {conv.last_message.sender_nickname}: {conv.last_message.content}
                    </p>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </main>
    </NicknameGate>
  )
}
