import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function hashIp(ip: string) {
  return createHash('sha256').update(ip + 'pixelin_salt_2024').digest('hex').slice(0, 16)
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

  let query = db()
    .from('posts')
    .select('id, content, image_url, nickname, created_at, reaction_count, comment_count')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const res = NextResponse.json({ posts: data })
  res.headers.set('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60')
  return res
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { content, image_url, nickname, fingerprint } = body

  if (!nickname || (!content && !image_url)) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const supabase = db()

  // check if fingerprint is blocked
  if (fingerprint) {
    const { data: blocked } = await supabase
      .from('blocked_fingerprints')
      .select('id')
      .eq('fingerprint', fingerprint)
      .maybeSingle()
    if (blocked) return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }

  // 3 posts per 7 days per fingerprint
  if (fingerprint) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('fingerprint', fingerprint)
      .gte('created_at', weekAgo)
    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'post_limit_reached' }, { status: 429 })
    }
  }

  const ip_hash = hashIp(getIp(req))

  const { data, error } = await supabase
    .from('posts')
    .insert({ content, image_url, nickname, ip_hash, fingerprint })
    .select('id, content, image_url, nickname, created_at, reaction_count, comment_count')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data }, { status: 201 })
}
