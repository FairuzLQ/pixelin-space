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
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({})
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [newPostsBanner, setNewPostsBanner] = useState(false)
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
      if (data.reactions) {
        setReactionsMap(prev => ({ ...prev, ...data.reactions }))
      }
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

  // Realtime: subscribe to new posts via postgres_changes (posts table is public)
  // Requires: ALTER PUBLICATION supabase_realtime ADD TABLE posts; (run once in Supabase SQL editor)
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    const channel = supabase
      .channel('feed-posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          const newPost = payload.new as Post
          if (latestCreatedAt.current && newPost.created_at > latestCreatedAt.current) {
            setNewPostsBanner(true)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Fallback poll (60s) — catches new posts if Realtime is not yet enabled on table
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/posts')
        const data = await res.json()
        const newest: Post[] = data.posts ?? []
        if (newest.length > 0 && latestCreatedAt.current && newest[0].created_at > latestCreatedAt.current) {
          setNewPostsBanner(true)
        }
      } catch { /* ignore */ }
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  function loadNewPosts() {
    setNewPostsBanner(false)
    setLoading(true)
    setCursor(null)   // reset cursor so infinite scroll starts from top after refresh
    setHasMore(true)
    loadPosts()
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
  }

  function onDeleted(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id))
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

        {newPostsBanner && (
          <button
            onClick={loadNewPosts}
            className="w-full py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(124,106,247,0.2)', color: 'var(--accent2)', border: '1px solid rgba(124,106,247,0.35)' }}
          >
            ✦ ada post baru — tap untuk refresh
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
