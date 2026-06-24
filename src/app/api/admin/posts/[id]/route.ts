import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isAdminAuthed } from '@/lib/adminAuth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const { error } = await adminDb().from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
