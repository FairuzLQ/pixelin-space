import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isAdminAuthed } from '@/lib/adminAuth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const db = adminDb()
  const { data: comment } = await db.from('comments').select('post_id').eq('id', id).single()
  if (comment) await db.rpc('decrement_comments', { pid: comment.post_id })
  const { error } = await db.from('comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
