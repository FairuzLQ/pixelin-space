import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminAuthed } from '@/lib/adminAuth'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await db()
    .from('posts')
    .select('id, nickname, content, image_url, ip_hash, fingerprint, created_at, reaction_count, comment_count')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}
