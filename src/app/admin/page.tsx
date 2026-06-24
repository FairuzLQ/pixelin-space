'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (res.ok) {
      router.push('/admin/dashboard')
    } else {
      setError('username atau password salah')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="card p-8 w-full max-w-sm flex flex-col gap-5">
        <div className="text-center">
          <div className="text-2xl mb-2">⚙</div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>admin panel</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>pixelin.space</p>
        </div>

        <form onSubmit={login} className="flex flex-col gap-3">
          <input
            className="w-full px-4 py-3 text-sm"
            placeholder="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            className="w-full px-4 py-3 text-sm"
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="btn-primary w-full py-3 text-sm"
            disabled={loading}
          >
            {loading ? 'masuk...' : 'masuk →'}
          </button>
        </form>
      </div>
    </div>
  )
}
