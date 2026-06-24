'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import type { Post, Comment } from '@/types/database'
import { getFingerprint } from '@/lib/fingerprint'
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

interface Props {
  post: Post
  initialReactions?: Record<string, number>
  initialMine?: string[]
}

export default function PostCard({ post, initialReactions = {}, initialMine = [] }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(initialReactions)
  const [mine, setMine] = useState<Set<string>>(new Set(initialMine))
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [reacting, setReacting] = useState(false)
  const [imgExpanded, setImgExpanded] = useState(false)

  const react = useCallback(async (type: string) => {
    if (reacting) return
    setReacting(true)

    const fp = getFingerprint()
    const wasActive = mine.has(type)

    setCounts(prev => ({
      ...prev,
      [type]: Math.max(0, (prev[type] ?? 0) + (wasActive ? -1 : 1)),
    }))
    setMine(prev => {
      const next = new Set(prev)
      wasActive ? next.delete(type) : next.add(type)
      return next
    })

    await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, type, fingerprint: fp }),
    })
    setReacting(false)
  }, [mine, post.id, reacting])

  return (
    <article className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}
        >
          {post.nickname.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {post.nickname}
          </span>
          <span className="text-xs ml-2" style={{ color: 'var(--text2)' }}>
            {timeAgo(post.created_at)}
          </span>
        </div>
      </div>

      {post.content && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
          {post.content}
        </p>
      )}

      {post.image_url && (
        <div
          className="rounded-lg overflow-hidden cursor-pointer"
          onClick={() => setImgExpanded(e => !e)}
        >
          <Image
            src={post.image_url}
            alt="post image"
            width={600}
            height={400}
            className="w-full object-cover rounded-lg"
            style={{ maxHeight: imgExpanded ? 'none' : '300px', objectFit: 'cover' }}
          />
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {REACTIONS.map(r => (
          <button
            key={r.type}
            onClick={() => react(r.type)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
            style={{
              background: mine.has(r.type) ? 'rgba(124,106,247,0.2)' : 'var(--bg3)',
              color: mine.has(r.type) ? 'var(--accent2)' : 'var(--text2)',
              border: mine.has(r.type) ? '1px solid rgba(124,106,247,0.4)' : '1px solid transparent',
            }}
          >
            <span>{r.emoji}</span>
            {(counts[r.type] ?? 0) > 0 && <span>{counts[r.type]}</span>}
          </button>
        ))}

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
