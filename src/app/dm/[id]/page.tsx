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
  // ref-based seen-IDs set for synchronous dedup across broadcast + poll + send
  const seenIds = useRef<Set<string>>(new Set())
  const accessDeniedRef = useRef(false)
  // holds the subscribed Realtime channel so send() can broadcast through it
  const realtimeChannelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']> | null>(null)
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

  // helper: add a message if not already seen (synchronous via Set ref)
  function addMessage(msg: DmMessage, scrollIfAtBottom = true) {
    if (seenIds.current.has(msg.id)) return false
    seenIds.current.add(msg.id)
    const atBottom = isNearBottom()
    lastMsgCreatedAt.current = msg.created_at
    setMessages(prev => [...prev, msg])
    localStorage.setItem(DM_SEEN_KEY, Date.now().toString())
    if (scrollIfAtBottom && (atBottom || msg.sender_nickname === myNicknameRef.current)) {
      setTimeout(() => scrollToBottom(), 50)
    }
    return true
  }

  // initial load
  useEffect(() => {
    if (!myNicknameRef.current) return
    fetch(buildDmUrl())
      .then(async r => {
        if (r.status === 403 || r.status === 400) {
          accessDeniedRef.current = true
          setAccessDenied(true)
          setLoading(false)
          return
        }
        const d = await r.json()
        const msgs: DmMessage[] = d.messages ?? []
        msgs.forEach(m => seenIds.current.add(m.id))
        setMessages(msgs)
        setParticipants(d.participants ?? [])
        if (msgs.length > 0) lastMsgCreatedAt.current = msgs[msgs.length - 1].created_at
        setLoading(false)
        setTimeout(() => scrollToBottom(false), 50)
      })
      .catch(() => {
        accessDeniedRef.current = true
        setAccessDenied(true)
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Realtime: subscribe to broadcast channel for instant message delivery.
  // We save the channel ref so send() can broadcast through the already-open WebSocket
  // instead of making a separate REST call from the server.
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    const channel = supabase
      .channel(`dm-${id}`)
      .on('broadcast', { event: 'new-message' }, ({ payload }) => {
        addMessage(payload as DmMessage)
      })
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      realtimeChannelRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Fallback poll (30s) — catches messages if Realtime WS disconnects
  useEffect(() => {
    const interval = setInterval(async () => {
      if (accessDeniedRef.current) return // stop polling after access denied
      const since = lastMsgCreatedAt.current
      if (!since) return
      try {
        const res = await fetch(buildDmUrl(`since=${encodeURIComponent(since)}`))
        if (!res.ok) return
        const data = await res.json()
        const newMsgs: DmMessage[] = data.messages ?? []
        let anyAdded = false
        for (const msg of newMsgs) {
          if (addMessage(msg, false)) anyAdded = true
        }
        if (anyAdded && isNearBottom()) setTimeout(() => scrollToBottom(), 50)
      } catch { /* ignore */ }
    }, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function send() {
    if (!input.trim() || !myNickname || sending) return
    setSending(true)
    const content = input.trim()
    setInput('') // optimistically clear input
    try {
      const res = await fetch(`/api/dm/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          sender_nickname: myNickname,
          sender_fingerprint: getFingerprint(),
        }),
      })
      const data = await res.json()
      if (data.message) {
        addMessage(data.message) // add for sender immediately
        // broadcast to other participants via the already-open WebSocket (self: false by default)
        realtimeChannelRef.current?.send({
          type: 'broadcast',
          event: 'new-message',
          payload: data.message,
        }).catch(() => {})
      } else if (!res.ok) {
        setInput(content) // restore on error
      }
    } catch {
      setInput(content) // restore on network error
    } finally {
      setSending(false)
    }
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
