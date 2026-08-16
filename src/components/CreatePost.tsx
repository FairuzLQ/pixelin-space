'use client'

import { useState, useEffect } from 'react'
import type { Post } from '@/types/database'
import { getNickname, getFingerprint, getNicknameExpiresAt } from '@/lib/fingerprint'

interface Props {
  onPosted: (post: Post) => void
}

function daysUntil(date: Date) {
  const diff = date.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

const MAX_CHARS = 1000

export default function CreatePost({ onPosted }: Props) {
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [postCount, setPostCount] = useState<number | null>(null)

  const expiresAt = getNicknameExpiresAt()
  const daysLeft = expiresAt ? daysUntil(expiresAt) : null

  useEffect(() => {
    const fp = getFingerprint()
    if (!fp || fp === 'server') return
    fetch(`/api/posts/count?fingerprint=${fp}`)
      .then(r => r.json())
      .then(d => setPostCount(d.count ?? null))
      .catch(() => {})
  }, [])

  async function submit() {
    const nickname = getNickname()
    if (!nickname || posting) return
    if (!content.trim()) return
    setPosting(true)
    setError(null)

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.trim(),
        nickname,
        fingerprint: getFingerprint(),
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (res.status === 429) {
      if (data.error === 'post_limit_reached') {
        setError('that\'s 3 posts this week — resets next week ✷')
        setPostCount(3)
      } else {
        setError('slow down a sec ✷')
      }
      setPosting(false)
      return
    }
    if (res.status === 403) {
      setError(data.error === 'identity_mismatch'
        ? 'session expired — refresh the page'
        : 'your account is blocked by admin.')
      setPosting(false)
      return
    }

    if (data.post) {
      onPosted(data.post)
      setContent('')
      setExpanded(false)
      setPostCount(c => c !== null ? Math.min(3, c + 1) : null)
    }
    setPosting(false)
  }

  const charsLeft = MAX_CHARS - content.length
  const nearLimit = charsLeft <= 100
  const postLimitReached = postCount !== null && postCount >= 3

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {daysLeft !== null && daysLeft <= 2 && (
          <p className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: 'var(--lime)', color: 'var(--ink)', border: '2px solid var(--ink)' }}>
            name expires {daysLeft === 0 ? 'today' : `in ${daysLeft}d`}
          </p>
        )}
        {postCount !== null && (
          <span
            className="mono text-xs px-2 py-1 rounded-lg ml-auto font-bold"
            style={{
              background: postLimitReached ? 'var(--accent)' : 'var(--bg3)',
              color: 'var(--ink)',
              border: '2px solid var(--ink)',
            }}
          >
            {postCount}/3 this week
          </span>
        )}
      </div>

      <textarea
        className="w-full px-3 py-2 text-sm resize-none"
        rows={expanded ? 4 : 2}
        placeholder={postLimitReached ? 'weekly limit reached — resets next week ✷' : 'what\'s floating in your mind… #usehashtags'}
        value={content}
        onChange={e => setContent(e.target.value)}
        onFocus={() => { if (!postLimitReached) setExpanded(true) }}
        maxLength={MAX_CHARS}
        disabled={postLimitReached}
        style={{ opacity: postLimitReached ? 0.5 : 1 }}
        aria-label="write a post"
      />

      {error && (
        <p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{error}</p>
      )}

      {expanded && !postLimitReached && (
        <div className="flex items-center gap-2 flex-wrap">
          {nearLimit && (
            <span className="text-xs mono" style={{ color: charsLeft <= 20 ? 'var(--accent)' : 'var(--text2)' }}>
              {charsLeft}
            </span>
          )}

          <div className="ml-auto flex gap-2">
            <button
              className="btn-ghost text-xs px-3 py-2"
              onClick={() => { setExpanded(false); setContent(''); setError(null) }}
            >
              cancel
            </button>
            <button
              className="btn-primary text-xs px-4 py-2"
              onClick={submit}
              disabled={posting || !content.trim()}
            >
              {posting ? 'posting…' : 'post ✷'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
