import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import {
  anonDb, getIp, hashIp, isBlocked, ownsNickname, rateLimit, validateNickname,
} from '@/lib/apiGuards'
import { censorText } from '@/lib/wordFilter'

const MAX_CONTENT = 500

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const post_id = searchParams.get('post_id')
  if (!post_id) return NextResponse.json({ error: 'missing post_id' }, { status: 400 })

  const { data, error } = await anonDb()
    .from('comments')
    .select('id, post_id, content, nickname, created_at')
    .eq('post_id', post_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }

  const post_id = typeof body.post_id === 'string' ? body.post_id : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : ''
  const nickname = validateNickname(body.nickname)

  if (!post_id || !content || !nickname) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json({ error: 'content too long' }, { status: 400 })
  }

  let db
  try { db = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  if (!(await ownsNickname(db, nickname, fingerprint))) {
    return NextResponse.json({ error: 'identity_mismatch' }, { status: 403 })
  }
  if (await isBlocked(db, fingerprint)) {
    return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }
  // max 10 comments/min per identity
  if (!(await rateLimit(db, `comment:${fingerprint}`, 10, 60_000))) {
    return NextResponse.json({ error: 'slow_down' }, { status: 429 })
  }

  const ip_hash = hashIp(getIp(req))

  const { data, error } = await db
    .from('comments')
    .insert({ post_id, content: censorText(content), nickname, ip_hash, fingerprint })
    .select('id, post_id, content, nickname, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.rpc('increment_comments', { pid: post_id })
  return NextResponse.json({ comment: data }, { status: 201 })
}
