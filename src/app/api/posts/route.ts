import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminDb } from '@/lib/supabaseAdmin'
import { createHash } from 'crypto'

function anonDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT ?? 'pixelin_salt_2024'
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 16)
}

function getIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const limit = 20

  let query = anonDb()
    .from('posts')
    .select('id, content, image_url, nickname, created_at, reaction_count, comment_count')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { content, image_url, nickname, fingerprint } = body

  if (!nickname || (!content && !image_url)) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (content && content.length > 2000) {
    return NextResponse.json({ error: 'content too long' }, { status: 400 })
  }

  let db
  try { db = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  if (fingerprint) {
    const { data: blocked } = await db
      .from('blocked_fingerprints')
      .select('id')
      .eq('fingerprint', fingerprint)
      .maybeSingle()
    if (blocked) return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }

  if (fingerprint) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await db
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('fingerprint', fingerprint)
      .gte('created_at', weekAgo)
    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'post_limit_reached' }, { status: 429 })
    }
  }

  const ip_hash = hashIp(getIp(req))

  const { data, error } = await db
    .from('posts')
    .insert({ content, image_url, nickname, ip_hash, fingerprint })
    .select('id, content, image_url, nickname, created_at, reaction_count, comment_count')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await broadcastEvent('feed-events', 'post-created', { post: data })

  return NextResponse.json({ post: data }, { status: 201 })
}

async function broadcastEvent(topic: string, event: string, payload: object) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
    })
  } catch { /* ignore */ }
}
