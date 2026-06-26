'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import { getNickname, getFingerprint } from '@/lib/fingerprint'
import { getSupabase } from '@/lib/supabaseClient'
import type { DmMessage } from '@/types/database'

const DM_SEEN_KEY = 'ps_dm_last_seen'

interface Participant { nickname: string; fingerprint: string }

export default function DmChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastMsgCreatedAt = useRef<string | null>(null)
  const myNicknameRef = useRef<string | null>(null)
  const router = useRouter()

  const myNickname = getNickname()
  myNicknameRef.current = myNickname

  // mark DMs as seen and keep refreshing the timestamp while on this page
  useEffect(() => {
    function markSeen() {
      localStorage.setItem(DM_SEEN_KEY, Date.now().toString())
    }
    markSeen()
    const timer = setInterval(markSeen, 10000)
    return () => clearInterval(timer)
  }, [])

  function isNearBottom() {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }

  function buildDmUrl(extra?: string) {
    const fp = getFingerprint()
    const nick = encodeURIComponent(myNicknameRef.current ?? '')
    const base = `/api/dm/${id}?fingerprint=${fp}&nickname=${nick}`
    return extra ? `${base}&${extra}` : base
  }

  // initial load
  useEffect(() => {
    if (!myNicknameRef.current) return
    fetch(buildDmUrl())
      .then(async r => {
        if (r.status === 403 || r.status === 400) { setAccessDenied(true); setLoading(false); return }
        const d = await r.json()
        const msgs: DmMessage[] = d.messages ?? []
        setMessages(msgs)
        setParticipants(d.participants ?? [])
        if (msgs.length > 0) lastMsgCreatedAt.current = msgs[msgs.length - 1].created_at
        setLoading(false)
        setTimeout(() => scrollToBottom(false), 50)
      })
      .catch(() => { setAccessDenied(true); setLoading(false) })
  }, [id])

  // Realtime: subscribe to broadcast channel for instant message delivery
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    const channel = supabase
      .channel(`dm-${id}`)
      .on('broadcast', { event: 'new-message' }, ({ payload }) => {
        const msg = payload as DmMessage
        const atBottom = isNearBottom()
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev // dedup with poll
          return [...prev, msg]
        })
        lastMsgCreatedAt.current = msg.created_at
        localStorage.setItem(DM_SEEN_KEY, Date.now().toString())
        if (atBottom || msg.sender_nickname === myNicknameRef.current) {
          setTimeout(() => scrollToBottom(), 50)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  // Fallback poll (30s) — catches messages if Realtime WS disconnects
  useEffect(() => {
    const interval = setInterval(async () => {
      const since = lastMsgCreatedAt.current
      if (!since) return
      try {
        const res = await fetch(buildDmUrl(`since=${encodeURIComponent(since)}`))
        const data = await res.json()
        const newMsgs: DmMessage[] = data.messages ?? []
        if (newMsgs.length === 0) return

        const atBottom = isNearBottom()
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const fresh = newMsgs.filter(m => !existingIds.has(m.id))
          if (fresh.length === 0) return prev
          return [...prev, ...fresh]
        })
        lastMsgCreatedAt.current = newMsgs[newMsgs.length - 1].created_at
        localStorage.setItem(DM_SEEN_KEY, Date.now().toString())
        if (atBottom) setTimeout(() => scrollToBottom(), 50)
      } catch { /* ignore */ }
    }, 30000) // 30s fallback — Realtime handles the real-time delivery
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
        sender_fingerprint: getFingerprint(),
      }),
    })
    const data = await res.json()
    if (data.message) {
      setMessages(prev => [...prev, data.message])
      lastMsgCreatedAt.current = data.message.created_at
      setInput('')
      setTimeout(() => scrollToBottom(), 50)
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
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() => router.push('/dm')}
          >
            ← back
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}
          >
            {title.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{title}</span>
          <span className="text-xs ml-auto shrink-0" style={{ color: 'var(--text2)' }}>
            {participants.length}/3
          </span>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-2 pb-2">
            {loading && <p className="text-xs text-center" style={{ color: 'var(--text2)' }}>loading...</p>}
          {!loading && accessDenied && (
            <div className="text-center py-12 flex flex-col gap-2">
              <p className="text-sm" style={{ color: '#f87171' }}>conversation tidak ditemukan</p>
              <button className="text-xs btn-ghost mx-auto" onClick={() => router.push('/dm')}>← kembali ke dms</button>
            </div>
          )}
          {!loading && !accessDenied && messages.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text2)' }}>
              start the conversation ✦
            </p>
          )}
          {!accessDenied && messages.map(msg => {
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
                    className="px-3 py-2 text-sm"
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

        <div className="flex gap-2 pt-2 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <input
            className="flex-1 px-4 py-3 text-sm"
            style={{ borderRadius: '24px' }}
            placeholder="type something..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
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
