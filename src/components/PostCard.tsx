'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { Post } from '@/types/database'
import { getFingerprint, getNickname } from '@/lib/fingerprint'
import CommentSection from './CommentSection'

const REACTIONS = [
  { type: 'fire', emoji: '🔥' },
  { type: 'laugh', emoji: '😭' },
  { type: 'love', emoji: '🫀' },
  { type: 'star', emoji: '✦' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getStoredMine(postId: string): Set<string> {
  try {
    const raw = localStorage.getItem('ps_reactions')
    if (!raw) return new Set()
    const data = JSON.parse(raw)
    return new Set(data[postId] ?? [])
  } catch { return new Set() }
}

function storeMine(postId: string, mine: Set<string>) {
  try {
    const raw = localStorage.getItem('ps_reactions')
    const data = raw ? JSON.parse(raw) : {}
    data[postId] = Array.from(mine)
    localStorage.setItem('ps_reactions', JSON.stringify(data))
  } catch { /* ignore */ }
}

export default function PostCard({ post }: { post: Post }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [reacting, setReacting] = useState(false)
  const [imgExpanded, setImgExpanded] = useState(false)
  const [dmLoading, setDmLoading] = useState(false)
  const router = useRouter()
  const fp = useRef(getFingerprint())

  useEffect(() => {
    // restore "mine" from localStorage immediately
    const storedMine = getStoredMine(post.id)
    setMine(storedMine)

    // fetch live counts from API
    fetch(`/api/reactions?post_id=${post.id}&fingerprint=${fp.current}`)
      .then(r => r.json())
      .then(d => {
        setCounts(d.counts ?? {})
        // API is the source of truth for "mine" — sync localStorage too
        const apiMine = new Set<string>(d.mine ?? [])
        setMine(apiMine)
        storeMine(post.id, apiMine)
        setLoaded(true)
      })
  }, [post.id])

  const react = useCallback(async (type: string) => {
    if (reacting) return
    setReacting(true)

    const wasActive = mine.has(type)

    // optimistic update
    const newMine = new Set(mine)
    wasActive ? newMine.delete(type) : newMine.add(type)
    setMine(newMine)
    storeMine(post.id, newMine)
    setCounts(prev => ({
      ...prev,
      [type]: Math.max(0, (prev[type] ?? 0) + (wasActive ? -1 : 1)),
    }))

    await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, type, fingerprint: fp.current }),
    })
    setReacting(false)
  }, [mine, post.id, reacting])

  async function openDm() {
    const myNickname = getNickname()
    if (!myNickname || myNickname === post.nickname || dmLoading) return
    setDmLoading(true)

    const res = await fetch('/api/dm/find-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        my_nickname: myNickname,
        my_fingerprint: fp.current,
        target_nickname: post.nickname,
      }),
    })
    const data = await res.json()
    if (data.conversation_id) {
      router.push(`/dm/${data.conversation_id}`)
    }
    setDmLoading(false)
  }

  const isMe = getNickname() === post.nickname

  return (
    <article className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}
        >
          {post.nickname.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
            {post.nickname}
          </span>
          <span className="text-xs shrink-0" style={{ color: 'var(--text2)' }}>
            {timeAgo(post.created_at)}
          </span>
          {!isMe && (
            <button
              onClick={openDm}
              disabled={dmLoading}
              className="shrink-0 text-xs px-2 py-0.5 rounded-md ml-1"
              style={{
                background: 'var(--bg3)',
                color: 'var(--text2)',
                border: '1px solid var(--border)',
                opacity: dmLoading ? 0.5 : 1,
              }}
            >
              {dmLoading ? '...' : '✉ dm'}
            </button>
          )}
        </div>
      </div>

      {post.content && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
          {post.content}
        </p>
      )}

      {post.image_url && (
        <div className="rounded-lg overflow-hidden cursor-pointer" onClick={() => setImgExpanded(e => !e)}>
          <Image
            src={post.image_url}
            alt="post image"
            width={600}
            height={400}
            className="w-full rounded-lg"
            style={{ maxHeight: imgExpanded ? 'none' : '300px', objectFit: 'cover' }}
          />
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {REACTIONS.map(r => {
          const count = counts[r.type] ?? 0
          const active = mine.has(r.type)
          return (
            <button
              key={r.type}
              onClick={() => react(r.type)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
              style={{
                background: active ? 'rgba(124,106,247,0.2)' : 'var(--bg3)',
                color: active ? 'var(--accent2)' : loaded ? 'var(--text)' : 'var(--text2)',
                border: active ? '1px solid rgba(124,106,247,0.4)' : '1px solid transparent',
              }}
            >
              <span>{r.emoji}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          )
        })}

        <button
          onClick={() => setShowComments(v => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs ml-auto btn-ghost"
        >
          <span>💬</span>
          <span>{commentCount > 0 ? commentCount : 'reply'}</span>
        </button>
      </div>

      {showComments && (
        <CommentSection
          postId={post.id}
          onCommentAdded={() => setCommentCount(c => c + 1)}
        />
      )}
    </article>
  )
}
