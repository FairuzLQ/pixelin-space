import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isAdminAuthed } from '@/lib/adminAuth'

export async function DELETE() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = adminDb()

  // delete in order to respect foreign key constraints
  await db.from('dm_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('dm_participants').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('dm_conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('reactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('comments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('blocked_fingerprints').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  return NextResponse.json({ ok: true })
}
