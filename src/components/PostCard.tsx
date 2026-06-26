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

function storeMine(postId: string, mine: Set<string>) {
  try {
    const raw = localStorage.getItem('ps_reactions')
    const data = raw ? JSON.parse(raw) : {}
    data[postId] = Array.from(mine)
    localStorage.setItem('ps_reactions', JSON.stringify(data))
  } catch { /* ignore */ }
}

interface Props {
  post: Post
  initialReactions?: { counts: Record<string, number>; mine: string[] }
  onDeleted?: (id: string) => void
}

export default function PostCard({ post, initialReactions, onDeleted }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(initialReactions?.counts ?? {})
  const [mine, setMine] = useState<Set<string>>(new Set(initialReactions?.mine ?? []))
  const [reacting, setReacting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [imgExpanded, setImgExpanded] = useState(false)
  const [dmLoading, setDmLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const reactingRef = useRef(false)
  const router = useRouter()

  // only fetch individually if not pre-loaded from feed
  useEffect(() => {
    if (initialReactions) return
    fetch(`/api/reactions?post_id=${post.id}&fingerprint=${getFingerprint()}`)
      .then(r => r.json())
      .then(d => {
        setCounts(d.counts ?? {})
        const apiMine = new Set<string>(d.mine ?? [])
        setMine(apiMine)
        storeMine(post.id, apiMine)
      })
  }, [post.id, initialReactions])

  // sync when initialReactions updates (e.g. after bulk fetch)
  useEffect(() => {
    if (!initialReactions) return
    setCounts(initialReactions.counts)
    const m = new Set<string>(initialReactions.mine)
    setMine(m)
    storeMine(post.id, m)
  }, [initialReactions, post.id])

  const react = useCallback(async (type: string) => {
    if (reactingRef.current) return
    reactingRef.current = true
    setReacting(true)
    const wasActive = mine.has(type)

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
      body: JSON.stringify({ post_id: post.id, type, fingerprint: getFingerprint() }),
    })
    reactingRef.current = false
    setReacting(false)
  }, [mine, post.id])

  async function openDm() {
    const myNickname = getNickname()
    if (!myNickname || myNickname === post.nickname || dmLoading) return
    setDmLoading(true)
    const res = await fetch('/api/dm/find-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ my_nickname: myNickname, my_fingerprint: getFingerprint(), target_nickname: post.nickname }),
    })
    const data = await res.json()
    if (data.conversation_id) router.push(`/dm/${data.conversation_id}`)
    setDmLoading(false)
  }

  async function deletePost() {
    if (!confirm('Hapus post kamu?')) return
    setDeleting(true)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: getFingerprint() }),
    })
    if (res.ok) {
      onDeleted?.(post.id)
    } else {
      setDeleting(false)
    }
  }

  const myNickname = getNickname()
  const isMe = myNickname === post.nickname

  return (
    <article className="card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
          style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}
        >
          {post.nickname.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
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
              className="shrink-0 text-xs px-2 py-0.5 rounded-md"
              style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', opacity: dmLoading ? 0.5 : 1 }}
            >
              {dmLoading ? '...' : '✉ dm'}
            </button>
          )}
          {isMe && (
            <button
              onClick={deletePost}
              disabled={deleting}
              className="shrink-0 text-xs px-2 py-0.5 rounded-md ml-auto"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', opacity: deleting ? 0.5 : 1 }}
            >
              {deleting ? '...' : 'hapus'}
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
                color: active ? 'var(--accent2)' : 'var(--text)',
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
