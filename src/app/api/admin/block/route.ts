import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminAuthed } from '@/lib/adminAuth'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await db().from('blocked_fingerprints').select('*').order('blocked_at', { ascending: false })
  return NextResponse.json({ blocked: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { fingerprint, reason } = await req.json()
  if (!fingerprint) return NextResponse.json({ error: 'missing fingerprint' }, { status: 400 })

  const { error } = await db()
    .from('blocked_fingerprints')
    .upsert({ fingerprint, reason: reason ?? null }, { onConflict: 'fingerprint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { fingerprint } = await req.json()
  await db().from('blocked_fingerprints').delete().eq('fingerprint', fingerprint)
  return NextResponse.json({ ok: true })
}
