'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/types/database'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import PostCard from '@/components/PostCard'

export default function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = use(params)
  const decoded = decodeURIComponent(tag).toLowerCase()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/posts?tag=${encodeURIComponent(decoded)}`)
      .then(r => r.json())
      .then(d => { setPosts(d.posts ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [decoded])

  return (
    <NicknameGate>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button className="btn-ghost text-xs" onClick={() => router.push('/')}>← feed</button>
          <h1 className="display text-xl">
            <span className="hashtag">#{decoded}</span>
          </h1>
        </div>

        {loading ? (
          <p className="text-xs mono" style={{ color: 'var(--text2)' }}>loading…</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🏷️</div>
            <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>no posts with #{decoded} yet.</p>
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
