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

  // verify ownership with anon client (read is allowed)
  const { data: post } = await db()
    .from('posts')
    .select('id, fingerprint')
    .eq('id', id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (post.fingerprint !== fingerprint) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // delete with service role — anon key has no delete policy on posts table
  let admin
  try { admin = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { error } = await admin.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
