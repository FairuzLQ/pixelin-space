'use client'

import { useState, useEffect } from 'react'
import type { Comment } from '@/types/database'
import { getNickname, getFingerprint } from '@/lib/fingerprint'

const OWN_COMMENTS_KEY = 'ps_comment_ids'

function getOwnCommentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(OWN_COMMENTS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function addOwnCommentId(id: string) {
  try {
    const ids = getOwnCommentIds()
    ids.add(id)
    localStorage.setItem(OWN_COMMENTS_KEY, JSON.stringify(Array.from(ids)))
  } catch { /* ignore */ }
}

function removeOwnCommentId(id: string) {
  try {
    const ids = getOwnCommentIds()
    ids.delete(id)
    localStorage.setItem(OWN_COMMENTS_KEY, JSON.stringify(Array.from(ids)))
  } catch { /* ignore */ }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const MAX = 300

export default function CommentSection({
  postId,
  onCommentAdded,
  onCommentDeleted,
}: {
  postId: string
  onCommentAdded: () => void
  onCommentDeleted?: () => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownIds, setOwnIds] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setOwnIds(getOwnCommentIds())
    fetch(`/api/comments?post_id=${postId}`)
      .then(r => r.json())
      .then(d => {
        setComments(d.comments ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [postId])

  async function submit() {
    const content = input.trim()
    const nickname = getNickname()
    if (!content || submitting) return
    if (!nickname) {
      setError('username kamu expired — refresh halaman dulu ya')
      return
    }
    if (content.length > MAX) return
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, content, nickname, fingerprint: getFingerprint() }),
    })
    const data = await res.json()

    if (res.status === 403) {
      setError('akun kamu diblokir oleh admin.')
    } else if (data.comment) {
      setComments(c => [...c, data.comment])
      addOwnCommentId(data.comment.id)
      setOwnIds(getOwnCommentIds())
      setInput('')
      onCommentAdded()
    } else {
      setError('gagal kirim, coba lagi')
    }
    setSubmitting(false)
  }

  async function deleteComment(id: string) {
    if (!confirm('Hapus komentar kamu?')) return
    setDeletingId(id)
    const res = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: getFingerprint() }),
    })
    if (res.ok) {
      setComments(c => c.filter(x => x.id !== id))
      removeOwnCommentId(id)
      setOwnIds(getOwnCommentIds())
      onCommentDeleted?.()
    }
    setDeletingId(null)
  }

  const charsLeft = MAX - input.length
  const nearLimit = charsLeft <= 50

  return (
    <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
      {loading ? (
        <p className="text-xs" style={{ color: 'var(--text2)' }}>loading...</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 items-start group">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
                style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}
              >
                {c.nickname.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{c.nickname}</span>
                  <span className="text-xs" style={{ color: 'var(--text2)' }}>{timeAgo(c.created_at)}</span>
                  {ownIds.has(c.id) && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      disabled={deletingId === c.id}
                      className="text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                      style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                    >
                      {deletingId === c.id ? '...' : '×'}
                    </button>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{c.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text2)' }}>no replies yet. be first 👀</p>
          )}
        </div>
      )}

      {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

      <div className="flex gap-2 items-end">
        <div className="flex-1 flex flex-col gap-0.5">
          <input
            className="w-full px-3 py-2 text-xs"
            placeholder="write a reply..."
            value={input}
            onChange={e => { setInput(e.target.value); setError(null) }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            maxLength={MAX}
          />
          {nearLimit && input.length > 0 && (
            <span className="text-xs text-right pr-1" style={{ color: charsLeft <= 10 ? '#f87171' : 'var(--text2)' }}>
              {charsLeft}
            </span>
          )}
        </div>
        <button
          className="btn-primary text-xs px-3 py-2"
          onClick={submit}
          disabled={submitting || !input.trim()}
        >
          {submitting ? '...' : 'send'}
        </button>
      </div>
    </div>
  )
}
