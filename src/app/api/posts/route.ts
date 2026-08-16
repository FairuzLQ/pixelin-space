import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { broadcastEvent } from '@/lib/broadcast'
import {
  anonDb, getIp, hashIp, isBlocked, ownsNickname, rateLimit,
  validateNickname, isValidImageUrl,
} from '@/lib/apiGuards'
import { censorText } from '@/lib/wordFilter'

const MAX_CONTENT = 1000
const WEEKLY_POST_CAP = 3

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const sort = searchParams.get('sort') === 'top' ? 'top' : 'new'
  const q = searchParams.get('q')?.trim()
  const tag = searchParams.get('tag')?.trim().toLowerCase()
  const limit = 20

  let query = anonDb()
    .from('posts')
    .select('id, content, image_url, nickname, created_at, edited_at, reaction_count, comment_count')

  if (q) query = query.ilike('content', `%${q.replace(/[%_]/g, '\\$&')}%`)
  if (tag) query = query.ilike('content', `%#${tag.replace(/[%_]/g, '\\$&')}%`)

  // "top" ranks by reactions; feed pagination stays cursor-based on created_at.
  if (sort === 'top') {
    query = query.order('reaction_count', { ascending: false }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
    if (cursor) query = query.lt('created_at', cursor)
  }

  const { data, error } = await query.limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const res = NextResponse.json({ posts: data })
  // The default first page is identical for everyone (reactions are fetched
  // separately per fingerprint), so cache it at the edge. 100 readers then share
  // one Supabase hit per ~8s instead of hammering the DB on every load/poll.
  if (sort === 'new' && !q && !tag && !cursor) {
    res.headers.set('Cache-Control', 'public, s-maxage=8, stale-while-revalidate=30')
  }
  return res
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }

  const content = typeof body.content === 'string' ? body.content : null
  const image_url = body.image_url ?? null
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : ''
  const nickname = validateNickname(body.nickname)

  if (!nickname || (!content && !image_url)) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (content && content.length > MAX_CONTENT) {
    return NextResponse.json({ error: 'content too long' }, { status: 400 })
  }
  if (!isValidImageUrl(image_url)) {
    return NextResponse.json({ error: 'invalid image' }, { status: 400 })
  }

  let db
  try { db = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // identity: fingerprint must actually own this nickname (anti-impersonation)
  if (!(await ownsNickname(db, nickname, fingerprint))) {
    return NextResponse.json({ error: 'identity_mismatch' }, { status: 403 })
  }
  if (await isBlocked(db, fingerprint)) {
    return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }

  // anti-burst limiter on top of the weekly cap below
  if (!(await rateLimit(db, `post:${fingerprint}`, 3, 60_000))) {
    return NextResponse.json({ error: 'slow_down' }, { status: 429 })
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await db
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('fingerprint', fingerprint)
    .gte('created_at', weekAgo)
  if ((count ?? 0) >= WEEKLY_POST_CAP) {
    return NextResponse.json({ error: 'post_limit_reached' }, { status: 429 })
  }

  const ip_hash = hashIp(getIp(req))

  const { data, error } = await db
    .from('posts')
    .insert({ content: censorText(content), image_url: image_url || null, nickname, ip_hash, fingerprint })
    .select('id, content, image_url, nickname, created_at, edited_at, reaction_count, comment_count')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await broadcastEvent('feed-events', 'post-created', { post: data })

  return NextResponse.json({ post: data }, { status: 201 })
}
