import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

const SECRET = process.env.ADMIN_SECRET ?? 'fallback_secret'

export function signToken(username: string): string {
  const payload = `${username}:${Date.now()}`
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex')
  // base64url encode matching what proxy.ts expects
  const raw = `${payload}.${sig}`
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies()
  const token = store.get('ps_admin')?.value
  if (!token) return false

  try {
    const decoded = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    const lastDot = decoded.lastIndexOf('.')
    const payload = decoded.slice(0, lastDot)
    const sig = decoded.slice(lastDot + 1)
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex')
    return sig === expected
  } catch { return false }
}
