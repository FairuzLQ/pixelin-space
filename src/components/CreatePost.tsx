'use client'

import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import type { Post } from '@/types/database'
import { getNickname, getFingerprint } from '@/lib/fingerprint'

interface Props {
  onPosted: (post: Post) => void
}

export default function CreatePost({ onPosted }: Props) {
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const compressed = await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    })
    setImage(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  function removeImage() {
    setImage(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit() {
    const nickname = getNickname()
    if (!nickname || uploading) return
    if (!content.trim() && !image) return
    setUploading(true)

    let image_url: string | null = null

    if (image) {
      const fd = new FormData()
      fd.append('file', image)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) image_url = data.url
    }

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.trim() || null,
        image_url,
        nickname,
        fingerprint: getFingerprint(),
      }),
    })
    const data = await res.json()
    if (data.post) {
      onPosted(data.post)
      setContent('')
      removeImage()
      setExpanded(false)
    }
    setUploading(false)
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <textarea
        className="w-full px-3 py-2 text-sm resize-none"
        rows={expanded ? 4 : 2}
        placeholder="what's floating in your mind..."
        value={content}
        onChange={e => setContent(e.target.value)}
        onFocus={() => setExpanded(true)}
        maxLength={1000}
      />

      {preview && (
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="w-full rounded-lg object-cover max-h-56" />
          <button
            onClick={removeImage}
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            ×
          </button>
        </div>
      )}

      {expanded && (
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs px-3 py-2"
            onClick={() => fileRef.current?.click()}
          >
            📎 photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pickImage}
          />
          <div className="ml-auto flex gap-2">
            <button
              className="btn-ghost text-xs px-3 py-2"
              onClick={() => { setExpanded(false); setContent(''); removeImage() }}
            >
              cancel
            </button>
            <button
              className="btn-primary text-xs px-4 py-2"
              onClick={submit}
              disabled={uploading || (!content.trim() && !image)}
            >
              {uploading ? 'posting...' : 'post ✦'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
