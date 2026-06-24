'use client'

import { useState, useEffect } from 'react'
import type { Comment } from '@/types/database'
import { getNickname, getFingerprint } from '@/lib/fingerprint'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function CommentSection({
  postId,
  onCommentAdded,
}: {
  postId: string
  onCommentAdded: () => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/comments?post_id=${postId}`)
      .then(r => r.json())
      .then(d => {
        setComments(d.comments ?? [])
        setLoading(false)
      })
  }, [postId])

  async function submit() {
    const content = input.trim()
    const nickname = getNickname()
    if (!content || !nickname || submitting) return
    setSubmitting(true)

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: postId,
        content,
        nickname,
        fingerprint: getFingerprint(),
      }),
    })
    const data = await res.json()
    if (data.comment) {
      setComments(c => [...c, data.comment])
      setInput('')
      onCommentAdded()
    }
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
      {loading ? (
        <p className="text-xs" style={{ color: 'var(--text2)' }}>loading...</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 items-start">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}
              >
                {c.nickname.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {c.nickname}
                </span>
                <span className="text-xs ml-1" style={{ color: 'var(--text2)' }}>
                  {timeAgo(c.created_at)}
                </span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{c.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text2)' }}>no replies yet. be first 👀</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 text-xs"
          placeholder="write a reply..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          maxLength={500}
        />
        <button
          className="btn-primary text-xs px-3 py-2"
          onClick={submit}
          disabled={submitting || !input.trim()}
        >
          send
        </button>
      </div>
    </div>
  )
}
