import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

function getSecret(): string {
  const s = process.env.ADMIN_SECRET
  if (!s) throw new Error('ADMIN_SECRET env var is not set')
  return s
}

export function signToken(username: string): string {
  const secret = getSecret()
  const payload = `${username}:${Date.now()}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  const raw = `${payload}.${sig}`
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies()
  const token = store.get('ps_admin')?.value
  if (!token) return false

  try {
    const secret = getSecret()
    const decoded = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    const lastDot = decoded.lastIndexOf('.')
    const payload = decoded.slice(0, lastDot) // "username:timestamp"
    const sig = decoded.slice(lastDot + 1)
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
    // validate token age — prevents stolen tokens from being valid forever
    const ts = parseInt(payload.split(':')[1] ?? '0', 10)
    if (!ts || Date.now() - ts > SESSION_MAX_AGE_MS) return false
    return true
  } catch { return false }
}
