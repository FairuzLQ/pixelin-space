'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { Post } from '@/types/database'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import PostCard from '@/components/PostCard'
import CreatePost from '@/components/CreatePost'
import { getFingerprint } from '@/lib/fingerprint'

function ScrollTopButton() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const handler = () => setShow(window.scrollY > 600)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  if (!show) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-4 w-11 h-11 rounded-full flex items-center justify-center text-lg z-30 font-bold"
      style={{ background: 'var(--lime)', color: 'var(--ink)', border: '2.5px solid var(--ink)', boxShadow: 'var(--shadow)' }}
      aria-label="scroll to top"
    >
      ↑
    </button>
  )
}

type ReactionsMap = Record<string, { counts: Record<string, number>; mine: string[] }>
type Sort = 'new' | 'top'

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [newPostsBanner, setNewPostsBanner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({})
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('new')
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const loaderRef = useRef<HTMLDivElement>(null)
  const latestCreatedAt = useRef<string | null>(null)

  const plain = sort === 'new' && !activeQuery // "plain" feed = cursor paging + polling

  useEffect(() => {
    fetch('/api/admin/announcement')
      .then(r => r.json())
      .then(d => { if (d.announcement) setAnnouncement(d.announcement) })
      .catch(() => {})
  }, [])

  const fetchReactions = useCallback(async (postList: Post[]) => {
    if (postList.length === 0) return
    const fp = getFingerprint()
    const ids = postList.map(p => p.id).join(',')
    try {
      const res = await fetch(`/api/reactions?post_ids=${ids}&fingerprint=${fp}`)
      const data = await res.json()
      if (data.reactions) setReactionsMap(prev => ({ ...prev, ...data.reactions }))
    } catch { /* non-critical */ }
  }, [])

  const loadPosts = useCallback(async (cur?: string | null) => {
    const params = new URLSearchParams()
    if (sort === 'top') params.set('sort', 'top')
    if (activeQuery) params.set('q', activeQuery)
    if (cur && sort === 'new' && !activeQuery) params.set('cursor', cur)
    const qs = params.toString()
    // keep the empty-param URL stable so it shares the edge cache key
    const res = await fetch(qs ? `/api/posts?${qs}` : '/api/posts')
    const data = await res.json()
    const fetched: Post[] = data.posts ?? []

    setPosts(prev => cur ? [...prev, ...fetched] : fetched)
    // only the plain feed supports cursor pagination
    setHasMore(sort === 'new' && !activeQuery && fetched.length === 20)
    if (fetched.length > 0) {
      setCursor(fetched[fetched.length - 1].created_at)
      if (!cur) latestCreatedAt.current = fetched[0].created_at
    }
    setLoading(false)
    fetchReactions(fetched)
  }, [fetchReactions, sort, activeQuery])

  // reload whenever sort/query changes
  useEffect(() => {
    setLoading(true)
    setCursor(null)
    setHasMore(true)
    setNewPostsBanner(false)
    loadPosts()
  }, [loadPosts])

  // Poll every 30s (plain feed only): detect new posts, reconcile deletions
  useEffect(() => {
    if (!plain) return
    const timer = setInterval(async () => {
      try {
        // no cache-buster: ride the edge cache (~8s), which is plenty fresh for
        // the "new posts" banner and keeps polling nearly free at scale
        const res = await fetch('/api/posts')
        const data = await res.json()
        const newest: Post[] = data.posts ?? []
        if (newest.length === 0) return
        if (latestCreatedAt.current && newest[0].created_at > latestCreatedAt.current) {
          setNewPostsBanner(true)
        }
        const newestTs = newest[0].created_at
        const oldestTs = newest[newest.length - 1].created_at
        const newestIds = new Set(newest.map(p => p.id))
        setPosts(prev => prev.filter(p =>
          p.created_at > newestTs || p.created_at < oldestTs || newestIds.has(p.id),
        ))
      } catch { /* ignore */ }
    }, 30000)
    return () => clearInterval(timer)
  }, [plain])

  function refreshFeed() {
    setNewPostsBanner(false)
    setLoading(true)
    setCursor(null)
    setHasMore(true)
    loadPosts()
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) loadPosts(cursor)
      },
      { threshold: 0.1 },
    )
    const el = loaderRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [cursor, hasMore, loading, loadPosts])

  function onPosted(post: Post) {
    setPosts(prev => [post, ...prev])
    latestCreatedAt.current = post.created_at
  }
  function onDeleted(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id))
  }
  function onEdited(updated: Post) {
    setPosts(prev => prev.map(p => p.id === updated.id ? { ...p, content: updated.content, edited_at: updated.edited_at } : p))
  }

  function runSearch(e: React.FormEvent) {
    e.preventDefault()
    setActiveQuery(query.trim())
  }
  function clearSearch() {
    setQuery('')
    setActiveQuery('')
  }

  const segBtn = (val: Sort, label: string) => (
    <button
      onClick={() => setSort(val)}
      className="text-xs px-3 py-1.5 font-bold uppercase tracking-tight rounded-lg"
      style={{
        background: sort === val ? 'var(--ink)' : 'transparent',
        color: sort === val ? 'var(--paper)' : 'var(--ink)',
      }}
      aria-pressed={sort === val}
    >
      {label}
    </button>
  )

  return (
    <NicknameGate>
      <Navbar />
      <ScrollTopButton />
      <main className="max-w-xl mx-auto px-4 py-5 flex flex-col gap-4">
        {announcement && (
          <div
            className="px-4 py-3 rounded-xl text-xs font-bold text-center"
            style={{ background: 'var(--lime)', color: 'var(--ink)', border: '2.5px solid var(--ink)', boxShadow: 'var(--shadow-sm)' }}
          >
            📣 {announcement}
          </div>
        )}

        <CreatePost onPosted={onPosted} />

        {/* controls: sort + search */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ border: '2.5px solid var(--ink)', background: 'var(--bg2)' }}>
            {segBtn('new', 'new')}
            {segBtn('top', 'top')}
          </div>
          <form onSubmit={runSearch} className="flex-1 flex items-center gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm"
              placeholder="search posts / #tags…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="search posts"
            />
            {activeQuery
              ? <button type="button" onClick={clearSearch} className="btn-ghost text-xs px-3 py-2">clear</button>
              : <button type="submit" className="btn-primary text-xs px-3 py-2" aria-label="search">🔍</button>}
          </form>
        </div>

        {newPostsBanner && (
          <button
            onClick={refreshFeed}
            className="w-full py-2.5 rounded-xl text-xs font-bold"
            style={{ background: 'var(--accent)', color: 'var(--ink)', border: '2.5px solid var(--ink)', boxShadow: 'var(--shadow-sm)' }}
          >
            ✷ new posts — tap to refresh
          </button>
        )}

        {activeQuery && (
          <p className="text-xs mono" style={{ color: 'var(--text2)' }}>
            results for “{activeQuery}”
          </p>
        )}

        {loading && posts.length === 0 ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 rounded mb-3" style={{ background: 'var(--bg3)', width: '40%' }} />
                <div className="h-3 rounded mb-1.5" style={{ background: 'var(--bg3)', width: '100%' }} />
                <div className="h-3 rounded" style={{ background: 'var(--bg3)', width: '70%' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {posts.length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--text2)' }}>
                <div className="text-4xl mb-3">{activeQuery ? '🔍' : '✷'}</div>
                <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                  {activeQuery ? 'nothing found. try another word.' : 'the space is empty. be the first to post.'}
                </p>
              </div>
            )}

            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                initialReactions={reactionsMap[post.id]}
                onDeleted={onDeleted}
                onEdited={onEdited}
              />
            ))}

            <div ref={loaderRef} className="py-4 text-center text-xs mono" style={{ color: 'var(--text2)' }}>
              {hasMore ? 'loading more…' : posts.length > 0 ? '· · · end of space · · ·' : ''}
            </div>
          </>
        )}

        <footer className="flex items-center gap-3 justify-center pt-1 pb-6 text-xs" style={{ color: 'var(--text2)' }}>
          <Link href="/about" className="linkified">about &amp; rules</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="linkified">privacy</Link>
        </footer>
      </main>
    </NicknameGate>
  )
}
