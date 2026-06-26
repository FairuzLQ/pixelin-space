import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(req: NextRequest) {
  const { post_id, type, fingerprint } = await req.json()
  if (!post_id || !type || !fingerprint) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const supabase = db()
  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('post_id', post_id)
    .eq('type', type)
    .eq('fingerprint', fingerprint)
    .maybeSingle()

  if (existing) {
    await supabase.from('reactions').delete().eq('id', existing.id)
    await supabase.rpc('decrement_reactions', { pid: post_id })
    return NextResponse.json({ action: 'removed' })
  }

  await supabase.from('reactions').insert({ post_id, type, fingerprint })
  await supabase.rpc('increment_reactions', { pid: post_id })
  return NextResponse.json({ action: 'added' })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const post_id = searchParams.get('post_id')
  const post_ids = searchParams.get('post_ids') // bulk: comma-separated
  const fingerprint = searchParams.get('fingerprint') ?? ''

  if (!post_id && !post_ids) {
    return NextResponse.json({ error: 'missing post_id or post_ids' }, { status: 400 })
  }

  const ids = post_ids ? post_ids.split(',').filter(Boolean) : [post_id!]

  const { data } = await db()
    .from('reactions')
    .select('post_id, type, fingerprint')
    .in('post_id', ids)

  if (post_ids) {
    // bulk response: { reactions: { [postId]: { counts, mine } } }
    const result: Record<string, { counts: Record<string, number>; mine: string[] }> = {}
    for (const id of ids) result[id] = { counts: {}, mine: [] }

    for (const r of data ?? []) {
      const entry = result[r.post_id]
      if (!entry) continue
      entry.counts[r.type] = (entry.counts[r.type] ?? 0) + 1
      if (fingerprint && r.fingerprint === fingerprint) entry.mine.push(r.type)
    }

    const res = NextResponse.json({ reactions: result })
    res.headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30')
    return res
  }

  // single response (legacy)
  const counts: Record<string, number> = {}
  const mine = new Set<string>()
  for (const r of data ?? []) {
    counts[r.type] = (counts[r.type] ?? 0) + 1
    if (fingerprint && r.fingerprint === fingerprint) mine.add(r.type)
  }

  const res = NextResponse.json({ counts, mine: Array.from(mine) })
  res.headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30')
  return res
}
