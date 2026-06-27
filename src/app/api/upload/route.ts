import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

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

  // verify fingerprint has a valid claimed nickname this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: claim } = await db()
    .from('nickname_claims')
    .select('nickname')
    .eq('fingerprint', fingerprint)
    .gte('claimed_at', weekAgo)
    .maybeSingle()

  if (!claim) {
    return NextResponse.json({ error: 'no active nickname for this session' }, { status: 403 })
  }

  const safeExt = ext  // already validated above
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`

  const { error } = await db().storage
    .from('post-images')
    .upload(filename, file, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: urlData } = db().storage.from('post-images').getPublicUrl(filename)
  return NextResponse.json({ url: urlData.publicUrl })
}
