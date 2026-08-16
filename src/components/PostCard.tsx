'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/types/database'
import { getFingerprint, getNickname } from '@/lib/fingerprint'
import { RichText } from '@/lib/richText'
import { isSaved, toggleSaved } from '@/lib/bookmarks'
import CommentSection from './CommentSection'

const REACTIONS = [
  { type: 'fire', emoji: '🔥' },
  { type: 'laugh', emoji: '😭' },
  { type: 'love', emoji: '🫀' },
  { type: 'star', emoji: '✷' },
]

const AVATAR_COLORS = ['var(--accent)', 'var(--lime)', 'var(--pink)', 'var(--blue)']
const EDIT_WINDOW_MS = 15 * 60 * 1000
const MAX_CHARS = 1000

function avatarColor(nickname: string) {
  let h = 0
  for (let i = 0; i < nickname.length; i++) h = (h * 31 + nickname.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// kept at module scope so the time read isn't a purity violation in render
function withinEditWindow(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
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
  onEdited?: (post: Post) => void
  defaultOpenComments?: boolean
}

export default function PostCard({ post, initialReactions, onDeleted, onEdited, defaultOpenComments }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(initialReactions?.counts ?? {})
  const [mine, setMine] = useState<Set<string>>(new Set(initialReactions?.mine ?? []))
  const [showComments, setShowComments] = useState(!!defaultOpenComments)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [dmLoading, setDmLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [popKey, setPopKey] = useState<string | null>(null)

  // edit state
  const [content, setContent] = useState(post.content ?? '')
  const [editedAt, setEditedAt] = useState(post.edited_at)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.content ?? '')
  const [savingEdit, setSavingEdit] = useState(false)

  const reactingRef = useRef(false)
  const router = useRouter()

  useEffect(() => { setSaved(isSaved(post.id)) }, [post.id])

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
    const wasActive = mine.has(type)
    setPopKey(type)
    setTimeout(() => setPopKey(null), 200)

    const newMine = new Set(mine)
    if (wasActive) newMine.delete(type); else newMine.add(type)
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
    if (!confirm('Delete your post?')) return
    setDeleting(true)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: getFingerprint() }),
    })
    if (res.ok) onDeleted?.(post.id)
    else setDeleting(false)
  }

  async function saveEdit() {
    const next = draft.trim()
    if (!next || savingEdit) return
    setSavingEdit(true)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: next, fingerprint: getFingerprint() }),
    })
    if (res.ok) {
      const data = await res.json()
      setContent(next)
      setEditedAt(data.post?.edited_at ?? new Date().toISOString())
      setEditing(false)
      onEdited?.({ ...post, content: next, edited_at: data.post?.edited_at ?? null })
    }
    setSavingEdit(false)
  }

  async function share() {
    const url = `${window.location.origin}/p/${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'pixelin.space', url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch { /* user cancelled */ }
  }

  function toggleSave() {
    setSaved(toggleSaved(post.id))
  }

  const myNickname = getNickname()
  const isMe = myNickname === post.nickname
  const canEdit = isMe && withinEditWindow(post.created_at)

  return (
    <article className="card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mono"
          style={{ background: avatarColor(post.nickname), color: 'var(--ink)', border: '2.5px solid var(--ink)' }}
          aria-hidden
        >
          {post.nickname.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <span className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>
            {post.nickname}
          </span>
          <span className="mono text-xs shrink-0" style={{ color: 'var(--text2)' }}>
            {timeAgo(post.created_at)}{editedAt ? ' · edited' : ''}
          </span>
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {!isMe && (
              <button
                onClick={openDm}
                disabled={dmLoading}
                className="chip chip-tap text-xs"
                style={{ background: 'var(--bg2)' }}
                aria-label={`message ${post.nickname}`}
              >
                {dmLoading ? '…' : '✉ dm'}
              </button>
            )}
            {canEdit && !editing && (
              <button onClick={() => { setDraft(content); setEditing(true) }} className="chip chip-tap text-xs" aria-label="edit post">
                edit
              </button>
            )}
            {isMe && (
              <button
                onClick={deletePost}
                disabled={deleting}
                className="chip chip-tap text-xs"
                style={{ background: 'var(--accent)' }}
                aria-label="delete post"
              >
                {deleting ? '…' : 'del'}
              </button>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full px-3 py-2 text-sm resize-none"
            rows={3}
            value={draft}
            maxLength={MAX_CHARS}
            onChange={e => setDraft(e.target.value)}
            aria-label="edit content"
          />
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost text-xs" onClick={() => setEditing(false)}>cancel</button>
            <button className="btn-primary text-xs" onClick={saveEdit} disabled={savingEdit || !draft.trim()}>
              {savingEdit ? 'saving…' : 'save'}
            </button>
          </div>
        </div>
      ) : (
        content && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <RichText text={content} />
          </p>
        )
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {REACTIONS.map(r => {
          const count = counts[r.type] ?? 0
          const active = mine.has(r.type)
          return (
            <button
              key={r.type}
              onClick={() => react(r.type)}
              className={`chip chip-tap text-xs ${active ? 'chip-on' : ''}`}
              aria-pressed={active}
              aria-label={r.type}
            >
              <span className={popKey === r.type ? 'animate-pop inline-block' : 'inline-block'}>{r.emoji}</span>
              {count > 0 && <span className="mono">{count}</span>}
            </button>
          )
        })}

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={toggleSave} className={`chip chip-tap text-xs ${saved ? 'chip-on' : ''}`} aria-pressed={saved} aria-label="save post">
            {saved ? '★' : '☆'}
          </button>
          <button onClick={share} className="chip chip-tap text-xs" aria-label="share post">
            {copied ? 'copied!' : '↗'}
          </button>
          <button
            onClick={() => setShowComments(v => !v)}
            className="chip chip-tap text-xs"
            aria-expanded={showComments}
          >
            💬 <span className="mono">{commentCount > 0 ? commentCount : 'reply'}</span>
          </button>
        </div>
      </div>

      {showComments && (
        <CommentSection
          postId={post.id}
          onCommentAdded={() => setCommentCount(c => c + 1)}
          onCommentDeleted={() => setCommentCount(c => Math.max(0, c - 1))}
        />
      )}
    </article>
  )
}
