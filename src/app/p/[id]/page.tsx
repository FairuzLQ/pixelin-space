'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/types/database'
import Navbar from '@/components/Navbar'
import NicknameGate from '@/components/NicknameGate'
import PostCard from '@/components/PostCard'

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [post, setPost] = useState<Post | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then(async r => {
        if (!r.ok) { setState('notfound'); return }
        const d = await r.json()
        setPost(d.post)
        setState('ok')
      })
      .catch(() => setState('notfound'))
  }, [id])

  return (
    <NicknameGate>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-5 flex flex-col gap-4">
        <button className="btn-ghost text-xs self-start" onClick={() => router.push('/')}>← feed</button>

        {state === 'loading' && (
          <div className="card p-4 animate-pulse">
            <div className="h-4 rounded mb-3" style={{ background: 'var(--bg3)', width: '40%' }} />
            <div className="h-3 rounded mb-1.5" style={{ background: 'var(--bg3)', width: '100%' }} />
            <div className="h-3 rounded" style={{ background: 'var(--bg3)', width: '70%' }} />
          </div>
        )}

        {state === 'notfound' && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🕳️</div>
            <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>this post is gone.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>it may have been deleted or reset.</p>
          </div>
        )}

        {state === 'ok' && post && (
          <PostCard post={post} onDeleted={() => router.push('/')} defaultOpenComments />
        )}
      </main>
    </NicknameGate>
  )
}
