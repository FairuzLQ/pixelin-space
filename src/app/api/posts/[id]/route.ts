import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { broadcastEvent } from '@/lib/broadcast'
import { anonDb } from '@/lib/apiGuards'

const MAX_CONTENT = 1000
const EDIT_WINDOW_MS = 15 * 60 * 1000 // posts are editable for 15 min after creation

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await anonDb()
    .from('posts')
    .select('id, content, image_url, nickname, created_at, edited_at, reaction_count, comment_count')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ post: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let fingerprint: unknown
  try { ({ fingerprint } = await req.json()) } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }

  if (!fingerprint || typeof fingerprint !== 'string') {
    return NextResponse.json({ error: 'missing fingerprint' }, { status: 400 })
  }

  const { data: post } = await anonDb()
    .from('posts')
    .select('id, fingerprint')
    .eq('id', id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (post.fingerprint !== fingerprint) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let admin
  try { admin = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { error } = await admin.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await broadcastEvent('feed-events', 'post-deleted', { id })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }

  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!fingerprint) return NextResponse.json({ error: 'missing fingerprint' }, { status: 400 })
  if (!content) return NextResponse.json({ error: 'empty content' }, { status: 400 })
  if (content.length > MAX_CONTENT) return NextResponse.json({ error: 'content too long' }, { status: 400 })

  const { data: post } = await anonDb()
    .from('posts')
    .select('id, fingerprint, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (post.fingerprint !== fingerprint) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (Date.now() - new Date(post.created_at).getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: 'edit_window_closed' }, { status: 403 })
  }

  let admin
  try { admin = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { data, error } = await admin
    .from('posts')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, content, image_url, nickname, created_at, edited_at, reaction_count, comment_count')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}
