import { NextRequest, NextResponse } from 'next/server'

async function verifyToken(token: string): Promise<boolean> {
  try {
    const SECRET = process.env.ADMIN_SECRET ?? 'fallback_secret'
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
    const lastDot = decoded.lastIndexOf('.')
    const payload = decoded.slice(0, lastDot)
    const sig = decoded.slice(lastDot + 1)

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
    const expected = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return sig === expected
  } catch { return false }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/admin/dashboard')) {
    const token = req.cookies.get('ps_admin')?.value
    if (!token || !await verifyToken(token)) {
      return NextResponse.redirect(new URL('/admin', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/dashboard/:path*'],
}
