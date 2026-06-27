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
  const body = await req.json()
  const { post_id, content, nickname, fingerprint } = body

  if (!post_id || !content || !nickname) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (content.length > 1000) {
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

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ip_hash = hashIp(ip)

  const { data, error } = await db
    .from('comments')
    .insert({ post_id, content, nickname, ip_hash, fingerprint })
    .select('id, post_id, content, nickname, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.rpc('increment_comments', { pid: post_id })
  return NextResponse.json({ comment: data }, { status: 201 })
}
