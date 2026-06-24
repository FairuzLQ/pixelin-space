'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import { getNickname, getFingerprint } from '@/lib/fingerprint'
import type { DmMessage } from '@/types/database'

interface Participant { nickname: string; fingerprint: string }

export default function DmChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const myNickname = getNickname()
  const myFp = getFingerprint()

  useEffect(() => {
    fetch(`/api/dm/${id}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages ?? [])
        setParticipants(d.participants ?? [])
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // poll for new messages every 5s
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/dm/${id}`)
      const data = await res.json()
      setMessages(data.messages ?? [])
    }, 5000)
    return () => clearInterval(interval)
  }, [id])

  async function send() {
    if (!input.trim() || !myNickname || sending) return
    setSending(true)

    const res = await fetch(`/api/dm/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: input.trim(),
        sender_nickname: myNickname,
        sender_fingerprint: myFp,
      }),
    })
    const data = await res.json()
    if (data.message) {
      setMessages(prev => [...prev, data.message])
      setInput('')
    }
    setSending(false)
  }

  const others = participants.filter(p => p.nickname !== myNickname)
  const title = others.map(p => p.nickname).join(', ') || '...'

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <NicknameGate>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-4 flex flex-col" style={{ height: 'calc(100dvh - 56px)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() => router.push('/dm')}
          >
            ← back
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}
          >
            {title.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</span>
          <span className="text-xs ml-auto" style={{ color: 'var(--text2)' }}>
            {participants.length}/3
          </span>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-2">
          {loading && <p className="text-xs text-center" style={{ color: 'var(--text2)' }}>loading...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text2)' }}>
              start the conversation ✦
            </p>
          )}
          {messages.map(msg => {
            const isMe = msg.sender_nickname === myNickname
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[75%]">
                  {!isMe && (
                    <span className="text-xs mb-1 block" style={{ color: 'var(--text2)' }}>
                      {msg.sender_nickname}
                    </span>
                  )}
                  <div
                    className="px-3 py-2 rounded-2xl text-sm"
                    style={{
                      background: isMe ? 'var(--accent)' : 'var(--bg2)',
                      color: isMe ? 'white' : 'var(--text)',
                      border: isMe ? 'none' : '1px solid var(--border)',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--text2)', textAlign: isMe ? 'right' : 'left' }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <input
            className="flex-1 px-4 py-3 text-sm"
            style={{ borderRadius: '24px' }}
            placeholder="type something..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            maxLength={500}
          />
          <button
            className="btn-primary px-4 py-2 text-sm"
            style={{ borderRadius: '24px' }}
            onClick={send}
            disabled={sending || !input.trim()}
          >
            →
          </button>
        </div>
      </main>
    </NicknameGate>
  )
}
