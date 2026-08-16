import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { anonDb, isBlocked, rateLimit } from '@/lib/apiGuards'

const VALID_TYPES = new Set(['fire', 'laugh', 'love', 'star'])

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }

  const post_id = typeof body.post_id === 'string' ? body.post_id : ''
  const type = typeof body.type === 'string' ? body.type : ''
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : ''

  if (!post_id || !type || !fingerprint) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }

  let db
  try { db = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  if (await isBlocked(db, fingerprint)) {
    return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }
  // generous cap — reactions are cheap but shouldn't be scriptable at scale
  if (!(await rateLimit(db, `react:${fingerprint}`, 40, 60_000))) {
    return NextResponse.json({ error: 'slow_down' }, { status: 429 })
  }

  const { data: existing } = await db
    .from('reactions')
    .select('id')
    .eq('post_id', post_id)
    .eq('type', type)
    .eq('fingerprint', fingerprint)
    .maybeSingle()

  if (existing) {
    await db.from('reactions').delete().eq('id', existing.id)
    await db.rpc('decrement_reactions', { pid: post_id })
    return NextResponse.json({ action: 'removed' })
  }

  await db.from('reactions').insert({ post_id, type, fingerprint })
  await db.rpc('increment_reactions', { pid: post_id })
  return NextResponse.json({ action: 'added' })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const post_id = searchParams.get('post_id')
  const post_ids = searchParams.get('post_ids')
  const fingerprint = searchParams.get('fingerprint') ?? ''

  if (!post_id && !post_ids) {
    return NextResponse.json({ error: 'missing post_id or post_ids' }, { status: 400 })
  }

  const ids = post_ids ? post_ids.split(',').filter(Boolean) : [post_id!]

  const { data } = await anonDb()
    .from('reactions')
    .select('post_id, type, fingerprint')
    .in('post_id', ids)

  if (post_ids) {
    const result: Record<string, { counts: Record<string, number>; mine: string[] }> = {}
    for (const id of ids) result[id] = { counts: {}, mine: [] }

    for (const r of data ?? []) {
      const entry = result[r.post_id]
      if (!entry) continue
      entry.counts[r.type] = (entry.counts[r.type] ?? 0) + 1
      if (fingerprint && r.fingerprint === fingerprint) entry.mine.push(r.type)
    }

    const res = NextResponse.json({ reactions: result })
    res.headers.set('Cache-Control', 'private, max-age=15')
    return res
  }

  const counts: Record<string, number> = {}
  const mine = new Set<string>()
  for (const r of data ?? []) {
    counts[r.type] = (counts[r.type] ?? 0) + 1
    if (fingerprint && r.fingerprint === fingerprint) mine.add(r.type)
  }

  const res = NextResponse.json({ counts, mine: Array.from(mine) })
  res.headers.set('Cache-Control', 'private, max-age=15')
  return res
}
