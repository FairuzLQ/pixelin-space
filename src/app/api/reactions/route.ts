import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { post_id, type, fingerprint } = await req.json()
  if (!post_id || !type || !fingerprint) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  // toggle: remove if exists, add if not
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
  const fingerprint = searchParams.get('fingerprint')

  if (!post_id) return NextResponse.json({ error: 'missing post_id' }, { status: 400 })

  const { data } = await supabase
    .from('reactions')
    .select('type, fingerprint')
    .eq('post_id', post_id)

  const counts: Record<string, number> = {}
  const mine = new Set<string>()
  for (const r of data ?? []) {
    counts[r.type] = (counts[r.type] ?? 0) + 1
    if (fingerprint && r.fingerprint === fingerprint) mine.add(r.type)
  }

  return NextResponse.json({ counts, mine: Array.from(mine) })
}
