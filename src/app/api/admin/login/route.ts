import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
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
