'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/types/database'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import PostCard from '@/components/PostCard'
import { getSaved } from '@/lib/bookmarks'

export default function SavedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const ids = getSaved()
    if (ids.length === 0) { setLoading(false); return }
    // fetch each saved post; drop the ones that no longer exist
    Promise.all(ids.map(id =>
      fetch(`/api/posts/${id}`).then(r => r.ok ? r.json() : null).catch(() => null),
    )).then(results => {
      const found = results.filter(Boolean).map(d => d.post as Post)
      // preserve saved order
      const order = new Map(ids.map((id, i) => [id, i]))
      found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      setPosts(found)
      setLoading(false)
    })
  }, [])

  return (
    <NicknameGate>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button className="btn-ghost text-xs" onClick={() => router.push('/')}>← feed</button>
          <h1 className="display text-xl">★ saved</h1>
        </div>

        {loading ? (
          <p className="text-xs mono" style={{ color: 'var(--text2)' }}>loading…</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">☆</div>
            <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>nothing saved yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>tap ☆ on a post to keep it here.</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard key={post.id} post={post} onDeleted={id => setPosts(p => p.filter(x => x.id !== id))} />
          ))
        )}
      </main>
    </NicknameGate>
  )
}
