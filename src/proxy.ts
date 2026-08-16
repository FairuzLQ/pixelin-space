import { NextRequest, NextResponse } from 'next/server'

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // keep in sync with lib/adminAuth

// Edge-runtime token check for the admin dashboard *page* only. The real
// authorization boundary is isAdminAuthed() on every /api/admin route — this
// just avoids flashing the dashboard shell to signed-out users.
async function verifyToken(token: string): Promise<boolean> {
  const SECRET = process.env.ADMIN_SECRET
  if (!SECRET) return false // no fallback secret — deny if misconfigured
  try {
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
    const lastDot = decoded.lastIndexOf('.')
    if (lastDot < 0) return false
    const payload = decoded.slice(0, lastDot)
    const sig = decoded.slice(lastDot + 1)

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign'],
    )
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
    const expected = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (sig !== expected) return false

    // reject tokens older than the session window
    const ts = parseInt(payload.split(':')[1] ?? '0', 10)
    if (!ts || Date.now() - ts > SESSION_MAX_AGE_MS) return false
    return true
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
