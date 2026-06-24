'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Post } from '@/types/database'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import PostCard from '@/components/PostCard'
import CreatePost from '@/components/CreatePost'

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/admin/announcement')
      .then(r => r.json())
      .then(d => { if (d.announcement) setAnnouncement(d.announcement) })
      .catch(() => {})
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
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadPosts(cursor)
        }
      },
      { threshold: 0.1 }
    )
    const el = loaderRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [cursor, hasMore, loading, loadPosts])

  function onPosted(post: Post) {
    setPosts(prev => [post, ...prev])
  }

  return (
    <NicknameGate>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
        {announcement && (
          <div className="px-4 py-3 rounded-xl text-xs text-center" style={{ background: 'rgba(124,106,247,0.12)', color: 'var(--accent2)', border: '1px solid rgba(124,106,247,0.25)' }}>
            {announcement}
          </div>
        )}
        <CreatePost onPosted={onPosted} />

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
              <PostCard key={post.id} post={post} />
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
