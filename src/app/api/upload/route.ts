import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isBlocked, rateLimit, WEEK_MS } from '@/lib/apiGuards'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'])
const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'])
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png',
  'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif',
}
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const fingerprint = formData.get('fingerprint') as string | null

  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

  // require a fingerprint so anonymous callers without a nickname can't spam storage
  if (!fingerprint) return NextResponse.json({ error: 'missing fingerprint' }, { status: 400 })

  // validate file type against whitelist (MIME + extension)
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'invalid file type' }, { status: 400 })
  }
  // fall back to MIME-derived extension when filename has no valid ext
  // (happens when web worker compression strips File.name, or HEIC→JPEG conversion)
  const nameExt = file.name.split('.').pop()?.toLowerCase() ?? ''
  const ext = ALLOWED_EXTS.has(nameExt) ? nameExt : (MIME_TO_EXT[file.type] ?? '')
  if (!ext) {
    return NextResponse.json({ error: 'invalid file extension' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large (max 5 MB)' }, { status: 400 })
  }

  let supa
  try { supa = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  if (await isBlocked(supa, fingerprint)) {
    return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }

  // only established identities may upload — stops anonymous storage spam
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  const { data: claim } = await supa
    .from('nickname_claims')
    .select('nickname')
    .eq('fingerprint', fingerprint)
    .gte('claimed_at', weekAgo)
    .maybeSingle()
  if (!claim) {
    return NextResponse.json({ error: 'no_identity' }, { status: 403 })
  }

  // cap uploads to keep storage costs bounded
  if (!(await rateLimit(supa, `upload:${fingerprint}`, 12, 60 * 60_000))) {
    return NextResponse.json({ error: 'slow_down' }, { status: 429 })
  }

  const safeExt = ext
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`

  const { error } = await supa.storage
    .from('post-images')
    .upload(filename, file, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: urlData } = supa.storage.from('post-images').getPublicUrl(filename)
  return NextResponse.json({ url: urlData.publicUrl })
}
