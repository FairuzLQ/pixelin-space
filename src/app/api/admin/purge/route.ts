import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isAdminAuthed } from '@/lib/adminAuth'

export async function DELETE() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let db
  try {
    db = adminDb()
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const uuid0 = '00000000-0000-0000-0000-000000000000'

  const results = await Promise.allSettled([
    db.from('dm_messages').delete().neq('id', uuid0),
    db.from('dm_participants').delete().neq('id', uuid0),
    db.from('dm_conversations').delete().neq('id', uuid0),
    db.from('reactions').delete().neq('id', uuid0),
    db.from('comments').delete().neq('id', uuid0),
    db.from('posts').delete().neq('id', uuid0),
    db.from('blocked_fingerprints').delete().neq('id', uuid0),
  ])

  const errors = results
    .filter(r => r.status === 'fulfilled' && (r.value as { error: unknown }).error)
    .map(r => (r as PromiseFulfilledResult<{ error: { message: string } }>).value.error?.message)

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
