import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { signToken } from '@/lib/adminAuth'
import { adminDb } from '@/lib/supabaseAdmin'
import { getIp, hashIp, rateLimit } from '@/lib/apiGuards'

function safeEq(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch { return false }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }
  const username = typeof body.username === 'string' ? body.username : ''
  const password = typeof body.password === 'string' ? body.password : ''

  // throttle brute-force: 8 attempts / 10 min per IP
  try {
    const db = adminDb()
    if (!(await rateLimit(db, `adminlogin:${hashIp(getIp(req))}`, 8, 10 * 60_000))) {
      return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 })
    }
  } catch { /* if DB is unavailable, fall through — don't lock admins out entirely */ }

  const validUser = process.env.ADMIN_USERNAME ?? ''
  const validPass = process.env.ADMIN_PASSWORD ?? ''
  // constant-time compare both fields regardless of which is wrong (prevents oracle)
  const ok = safeEq(username ?? '', validUser) && safeEq(password ?? '', validPass)

  if (!ok) {
    // fixed 300ms delay on failure to slow brute-force attempts
    await new Promise(r => setTimeout(r, 300))
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
  }

  const token = signToken(username)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('ps_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('ps_admin')
  return res
}
