import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'

// Vercel cron: runs every Sunday at midnight UTC
// vercel.json: { "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 0 * * 0" }] }
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const db = adminDb()

  await db.from('dm_messages').delete().lt('created_at', cutoff)
  await db.from('dm_participants').delete().in(
    'conversation_id',
    (await db.from('dm_conversations').select('id').lt('last_message_at', cutoff)).data?.map(r => r.id) ?? []
  )
  await db.from('dm_conversations').delete().lt('last_message_at', cutoff)
  await db.from('reactions').delete().lt('created_at', cutoff)
  await db.from('comments').delete().lt('created_at', cutoff)
  await db.from('posts').delete().lt('created_at', cutoff)
  await db.from('nickname_claims').delete().lt('claimed_at', cutoff)

  return NextResponse.json({ ok: true, cutoff })
}
