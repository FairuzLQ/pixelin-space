'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Post {
  id: string
  nickname: string
  content: string | null
  image_url: string | null
  fingerprint: string | null
  ip_hash: string | null
  created_at: string
  reaction_count: number
  comment_count: number
}

interface Comment {
  id: string
  post_id: string
  nickname: string
  content: string
  fingerprint: string | null
  created_at: string
}

interface Blocked {
  id: string
  fingerprint: string
  reason: string | null
  blocked_at: string
}

type Tab = 'posts' | 'comments' | 'blocked' | 'settings'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [blocked, setBlocked] = useState<Blocked[]>([])
  const [loading, setLoading] = useState(true)
  const [announcement, setAnnouncement] = useState('')
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [announcementSaved, setAnnouncementSaved] = useState(false)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    const [postsRes, blockedRes] = await Promise.all([
      fetch('/api/admin/posts'),
      fetch('/api/admin/block'),
    ])
    // commentsRes must wait since it uses same auth check

    if (postsRes.status === 401) { router.push('/admin'); return }

    const commentsRes = await fetch('/api/admin/comments')

    const postsData = await postsRes.json()
    const blockedData = await blockedRes.json()
    const commentsData = await commentsRes.json()

    setPosts(postsData.posts ?? [])
    setBlocked(blockedData.blocked ?? [])
    setComments(commentsData.comments ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/admin/announcement')
      .then(r => r.json())
      .then(d => setAnnouncement(d.announcement ?? ''))
      .catch(() => {})
  }, [])

  async function saveAnnouncement() {
    setAnnouncementSaving(true)
    await fetch('/api/admin/announcement', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: announcement }),
    })
    setAnnouncementSaving(false)
    setAnnouncementSaved(true)
    setTimeout(() => setAnnouncementSaved(false), 2000)
  }

  async function deletePost(id: string) {
    if (!confirm('Hapus post ini?')) return
    const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(`Gagal hapus post (${res.status}): ${body.error ?? 'unknown error'}`)
      return
    }
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  async function deleteComment(id: string) {
    if (!confirm('Hapus komentar ini?')) return
    const res = await fetch(`/api/admin/comments/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(`Gagal hapus comment (${res.status}): ${body.error ?? 'unknown error'}`)
      return
    }
    setComments(prev => prev.filter(c => c.id !== id))
  }

  async function blockFingerprint(fingerprint: string, reason?: string) {
    if (!fingerprint) return
    await fetch('/api/admin/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, reason: reason ?? 'admin block' }),
    })
    load()
  }

  async function unblock(fingerprint: string) {
    await fetch('/api/admin/block', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint }),
    })
    setBlocked(prev => prev.filter(b => b.fingerprint !== fingerprint))
  }

  async function resetSessions() {
    if (!confirm('Force reset semua user sessions? Semua user akan diminta pilih username baru saat next visit.')) return
    const res = await fetch('/api/admin/reset-sessions', { method: 'POST' })
    if (res.ok) alert('✓ Session reset berhasil. Semua user akan logout saat next visit.')
    else alert('Gagal reset sessions.')
  }

  async function purgeAll() {
    if (!confirm('⚠️ PURGE ALL: hapus SEMUA data (posts, comments, DMs, reactions, blocked). Tidak bisa di-undo!')) return
    if (!confirm('Beneran yakin? Ini hapus semuanya sekaligus!')) return
    const res = await fetch('/api/admin/purge', { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(`Purge gagal (${res.status}): ${body.error ?? JSON.stringify(body.errors)}`)
      return
    }
    setPosts([])
    setComments([])
    setBlocked([])
  }

  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.push('/admin')
  }

  const isBlockedFp = (fp: string | null) => fp && blocked.some(b => b.fingerprint === fp)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <nav
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'rgba(7,7,15,0.9)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--accent2)' }}>⚙ admin panel</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(124,106,247,0.15)', color: 'var(--accent2)' }}>v1.0.0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text2)' }}>
            {posts.length} posts · {comments.length} comments · {blocked.length} blocked
          </span>
          <button
            className="text-xs px-3 py-2 rounded-lg"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            onClick={resetSessions}
          >
            ↺ reset sessions
          </button>
          <button
            className="text-xs px-3 py-2 rounded-lg font-semibold"
            style={{ background: 'rgba(239,68,68,0.25)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}
            onClick={purgeAll}
          >
            ☢ purge all
          </button>
          <button className="btn-ghost text-xs px-3 py-2" onClick={logout}>logout</button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {(['posts', 'comments', 'blocked', 'settings'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-xs px-4 py-2 rounded-lg"
              style={{
                background: tab === t ? 'var(--accent)' : 'var(--bg3)',
                color: tab === t ? 'white' : 'var(--text2)',
              }}
            >
              {t === 'posts' ? `posts (${posts.length})` : t === 'comments' ? `comments (${comments.length})` : t === 'blocked' ? `blocked (${blocked.length})` : 'settings'}
            </button>
          ))}
        </div>

        {loading && <p className="text-xs" style={{ color: 'var(--text2)' }}>loading...</p>}

        {!loading && tab === 'posts' && (
          <div className="flex flex-col gap-3">
            {posts.map(p => (
              <div key={p.id} className="card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{p.nickname}</span>
                    <span className="text-xs" style={{ color: 'var(--text2)' }}>{timeAgo(p.created_at)}</span>
                    {isBlockedFp(p.fingerprint) && (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>blocked</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {p.fingerprint && !isBlockedFp(p.fingerprint) && (
                      <button
                        className="text-xs px-3 py-1 rounded"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                        onClick={() => blockFingerprint(p.fingerprint!, `blocked from post ${p.id}`)}
                      >
                        block user
                      </button>
                    )}
                    <button
                      className="text-xs px-3 py-1 rounded"
                      style={{ background: 'rgba(239,68,68,0.25)', color: '#ef4444' }}
                      onClick={() => deletePost(p.id)}
                    >
                      hapus post
                    </button>
                  </div>
                </div>
                {p.content && (
                  <p className="text-xs" style={{ color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{p.content.slice(0, 200)}{p.content.length > 200 ? '...' : ''}</p>
                )}
                <div className="flex gap-3 text-xs" style={{ color: 'var(--text2)' }}>
                  <span>fp: {p.fingerprint ?? '-'}</span>
                  <span>ip: {p.ip_hash ?? '-'}</span>
                  <span>🔥{p.reaction_count} 💬{p.comment_count}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'comments' && (
          <div className="flex flex-col gap-3">
            {comments.map(c => (
              <div key={c.id} className="card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.nickname}</span>
                    <span className="text-xs" style={{ color: 'var(--text2)' }}>{timeAgo(c.created_at)}</span>
                    {isBlockedFp(c.fingerprint) && (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>blocked</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {c.fingerprint && !isBlockedFp(c.fingerprint) && (
                      <button
                        className="text-xs px-3 py-1 rounded"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                        onClick={() => blockFingerprint(c.fingerprint!, `blocked from comment`)}
                      >
                        block user
                      </button>
                    )}
                    <button
                      className="text-xs px-3 py-1 rounded"
                      style={{ background: 'rgba(239,68,68,0.25)', color: '#ef4444' }}
                      onClick={() => deleteComment(c.id)}
                    >
                      hapus
                    </button>
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>{c.content}</p>
                <span className="text-xs" style={{ color: 'var(--text2)' }}>fp: {c.fingerprint ?? '-'}</span>
              </div>
            ))}
            {comments.length === 0 && <p className="text-xs" style={{ color: 'var(--text2)' }}>no comments yet</p>}
          </div>
        )}

        {tab === 'settings' && (
          <div className="flex flex-col gap-4">
            <div className="card p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>site announcement</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
                  ditampilkan sebagai banner di atas feed. kosongkan untuk menyembunyikan.
                </p>
              </div>
              <textarea
                className="w-full px-3 py-2 text-sm resize-none"
                rows={3}
                maxLength={200}
                placeholder="contoh: posts & username reset tiap Minggu tengah malam ✦"
                value={announcement}
                onChange={e => { setAnnouncement(e.target.value); setAnnouncementSaved(false) }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text2)' }}>{announcement.length}/200</span>
                <button
                  className="btn-primary text-xs px-4 py-2"
                  onClick={saveAnnouncement}
                  disabled={announcementSaving}
                >
                  {announcementSaved ? '✓ saved' : announcementSaving ? 'saving...' : 'save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'blocked' && (
          <div className="flex flex-col gap-3">
            {blocked.length === 0 && <p className="text-xs" style={{ color: 'var(--text2)' }}>no blocked users</p>}
            {blocked.map(b => (
              <div key={b.id} className="card p-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-mono" style={{ color: 'var(--text)' }}>{b.fingerprint}</span>
                  <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
                    {b.reason ?? 'no reason'} · {timeAgo(b.blocked_at)}
                  </p>
                </div>
                <button
                  className="text-xs px-3 py-1 rounded shrink-0"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
                  onClick={() => unblock(b.fingerprint)}
                >
                  unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
