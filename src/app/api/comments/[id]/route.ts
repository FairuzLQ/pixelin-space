import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminDb } from '@/lib/supabaseAdmin'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { fingerprint } = await req.json()

  if (!fingerprint) return NextResponse.json({ error: 'missing fingerprint' }, { status: 400 })

  const { data: comment } = await db()
    .from('comments')
    .select('id, post_id, fingerprint')
    .eq('id', id)
    .maybeSingle()

  if (!comment) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (comment.fingerprint !== fingerprint) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let admin
  try { admin = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // delete first — decrement only if delete succeeded to prevent count drift
  const { error } = await admin.from('comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db().rpc('decrement_comments', { pid: comment.post_id })

  return NextResponse.json({ ok: true })
}
