import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isAdminAuthed } from '@/lib/adminAuth'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET() {
  const { data } = await db()
    .from('admin_settings')
    .select('key, value')
    .in('key', ['announcement', 'session_reset_at'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return NextResponse.json({
    announcement: map['announcement'] ?? '',
    session_reset_at: map['session_reset_at'] ?? null,
  })
}

export async function PUT(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { value } = await req.json()

  let adb
  try { adb = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  await adb.from('admin_settings').upsert(
    { key: 'announcement', value: value ?? '', updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )

  return NextResponse.json({ ok: true })
}
