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
  const myNickname = getNickname()

  useEffect(() => {
    const fp = getFingerprint()
    const nick = myNickname ?? ''
    fetch(`/api/dm?fingerprint=${fp}&nickname=${encodeURIComponent(nick)}`)
      .then(r => r.json())
      .then(d => {
        setConvs(d.conversations ?? [])
        setLoading(false)
      })
  }, [myNickname])

  return (
    <NicknameGate>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>direct messages</h1>
        </div>

        {loading ? (
          <p className="text-xs" style={{ color: 'var(--text2)' }}>loading...</p>
        ) : convs.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text2)' }}>
            <div className="text-4xl mb-3">✉</div>
            <p className="text-sm">no dms yet.</p>
            <p className="text-xs mt-2">tap <strong>✉ dm</strong> on someone&apos;s post to start a conversation.</p>
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
