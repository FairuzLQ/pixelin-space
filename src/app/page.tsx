'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Post } from '@/types/database'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import PostCard from '@/components/PostCard'
import CreatePost from '@/components/CreatePost'
import { getFingerprint } from '@/lib/fingerprint'
import { getSupabase } from '@/lib/supabaseClient'

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
      className="fixed bottom-6 right-4 w-10 h-10 rounded-full flex items-center justify-center text-sm z-30 shadow-lg"
      style={{ background: 'var(--bg2)', color: 'var(--accent2)', border: '1px solid var(--border)' }}
      aria-label="scroll to top"
    >
      ↑
    </button>
  )
}

type ReactionsMap = Record<string, { counts: Record<string, number>; mine: string[] }>

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  // pending = new posts waiting to be shown (Twitter-style: not inserted immediately)
  const [pendingPosts, setPendingPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({})
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)
  const latestCreatedAt = useRef<string | null>(null)

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
    const url = cur ? `/api/posts?cursor=${encodeURIComponent(cur)}` : '/api/posts'
    const res = await fetch(url)
    const data = await res.json()
    const fetched: Post[] = data.posts ?? []

    setPosts(prev => cur ? [...prev, ...fetched] : fetched)
    setHasMore(fetched.length === 20)
    if (fetched.length > 0) {
      setCursor(fetched[fetched.length - 1].created_at)
      if (!cur) latestCreatedAt.current = fetched[0].created_at
    }
    setLoading(false)
    fetchReactions(fetched)
  }, [fetchReactions])

  useEffect(() => { loadPosts() }, [loadPosts])

  // Add posts to pending queue (dedup by id)
  const queuePending = useCallback((incoming: Post[]) => {
    if (incoming.length === 0) return
    setPendingPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id))
      const fresh = incoming.filter(p => !existingIds.has(p.id))
      return fresh.length > 0 ? [...fresh, ...prev] : prev
    })
  }, [])

  // Remove a post from both visible and pending lists
  const removePost = useCallback((id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id))
    setPendingPosts(prev => prev.filter(p => p.id !== id))
  }, [])

  // Realtime: subscribe to feed-events broadcast channel
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    const channel = supabase
      .channel('feed-events')
      .on('broadcast', { event: 'post-created' }, ({ payload }) => {
        const newPost = payload.post as Post
        if (latestCreatedAt.current && newPost.created_at > latestCreatedAt.current) {
          queuePending([newPost])
        }
      })
      .on('broadcast', { event: 'post-deleted' }, ({ payload }) => {
        if (payload.id) removePost(payload.id as string)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queuePending, removePost])

  // Poll every 15s — catches new posts + reconciles deletions when Realtime isn't working
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/posts')
        const data = await res.json()
        const newest: Post[] = data.posts ?? []
        if (newest.length === 0) return

        // queue any new posts not yet visible
        if (latestCreatedAt.current) {
          const fresh = newest.filter(p => p.created_at > latestCreatedAt.current!)
          queuePending(fresh)
        }

        // reconcile deletions: page-1 posts missing from DB response were deleted
        const newestIds = new Set(newest.map(p => p.id))
        const oldestTs = newest[newest.length - 1].created_at
        setPosts(prev => prev.filter(p => p.created_at < oldestTs || newestIds.has(p.id)))
        setPendingPosts(prev => prev.filter(p => p.created_at < oldestTs || newestIds.has(p.id)))
      } catch { /* ignore */ }
    }, 15000)
    return () => clearInterval(timer)
  }, [queuePending])

  // Twitter-style: prepend pending posts to the top without full reload
  function showPendingPosts() {
    setPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id))
      const fresh = pendingPosts.filter(p => !existingIds.has(p.id))
      return [...fresh, ...prev]
    })
    if (pendingPosts.length > 0) {
      latestCreatedAt.current = pendingPosts[0].created_at
      fetchReactions(pendingPosts)
    }
    setPendingPosts([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) loadPosts(cursor)
      },
      { threshold: 0.1 }
    )
    const el = loaderRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [cursor, hasMore, loading, loadPosts])

  function onPosted(post: Post) {
    setPosts(prev => [post, ...prev])
    latestCreatedAt.current = post.created_at
    setPendingPosts(prev => prev.filter(p => p.id !== post.id))
  }

  function onDeleted(id: string) {
    removePost(id)
  }

  return (
    <NicknameGate>
      <Navbar />
      <ScrollTopButton />
      <main className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
        {announcement && (
          <div className="px-4 py-3 rounded-xl text-xs text-center" style={{ background: 'rgba(124,106,247,0.12)', color: 'var(--accent2)', border: '1px solid rgba(124,106,247,0.25)' }}>
            {announcement}
          </div>
        )}

        <CreatePost onPosted={onPosted} />

        {pendingPosts.length > 0 && (
          <button
            onClick={showPendingPosts}
            className="sticky top-2 z-20 w-full py-2.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: 'var(--accent)',
              color: 'white',
              boxShadow: '0 4px 20px rgba(124,106,247,0.4)',
            }}
          >
            ↑ {pendingPosts.length} post baru
          </button>
        )}

        {loading && posts.length === 0 ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 rounded mb-2" style={{ background: 'var(--bg3)', width: '40%' }} />
                <div className="h-3 rounded mb-1" style={{ background: 'var(--bg3)', width: '100%' }} />
                <div className="h-3 rounded" style={{ background: 'var(--bg3)', width: '70%' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {posts.length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--text2)' }}>
                <div className="text-4xl mb-3">✦</div>
                <p className="text-sm">the space is empty. be the first to post.</p>
              </div>
            )}

            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                initialReactions={reactionsMap[post.id]}
                onDeleted={onDeleted}
              />
            ))}

            <div ref={loaderRef} className="py-4 text-center text-xs" style={{ color: 'var(--text2)' }}>
              {hasMore ? 'loading more...' : posts.length > 0 ? '· · · end of space · · ·' : ''}
            </div>
          </>
        )}
      </main>
    </NicknameGate>
  )
}
