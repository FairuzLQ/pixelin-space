import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isAdminAuthed } from '@/lib/adminAuth'

export async function POST() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let db
  try { db = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const now = new Date().toISOString()
  await db.from('admin_settings').upsert(
    { key: 'session_reset_at', value: now, updated_at: now },
    { onConflict: 'key' }
  )

  return NextResponse.json({ ok: true, reset_at: now })
}
