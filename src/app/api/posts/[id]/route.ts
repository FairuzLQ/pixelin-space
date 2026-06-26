import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { fingerprint } = await req.json()

  if (!fingerprint) return NextResponse.json({ error: 'missing fingerprint' }, { status: 400 })

  const supabase = db()

  // verify post belongs to this fingerprint
  const { data: post } = await supabase
    .from('posts')
    .select('id, fingerprint')
    .eq('id', id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (post.fingerprint !== fingerprint) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
