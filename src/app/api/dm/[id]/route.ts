import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'

function db() {
  return adminDb()
}

async function assertParticipant(supabase: ReturnType<typeof db>, convId: string, fingerprint: string, nickname: string): Promise<boolean> {
  const byFp = supabase
    .from('dm_participants').select('id', { count: 'exact', head: true })
    .eq('conversation_id', convId).eq('fingerprint', fingerprint)
  const byPending = supabase
    .from('dm_participants').select('id', { count: 'exact', head: true })
    .eq('conversation_id', convId).eq('fingerprint', `pending_${nickname}`)
  const [r1, r2] = await Promise.all([byFp, byPending])
  return (r1.count ?? 0) > 0 || (r2.count ?? 0) > 0
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const since = url.searchParams.get('since')
  const fingerprint = url.searchParams.get('fingerprint')
  const nickname = url.searchParams.get('nickname')

  if (!fingerprint || !nickname) {
    return NextResponse.json({ error: 'missing fingerprint or nickname' }, { status: 400 })
  }

  let supabase
  try { supabase = db() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const allowed = await assertParticipant(supabase, id, fingerprint, nickname)
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let msgQuery = supabase
    .from('dm_messages')
    .select('id, sender_nickname, content, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (since) msgQuery = msgQuery.gt('created_at', since)

  const { data: messages, error } = await msgQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (since) {
    return NextResponse.json({ messages: messages ?? [] })
  }

  const { data: participants } = await supabase
    .from('dm_participants')
    .select('nickname') // fingerprint intentionally omitted from response
    .eq('conversation_id', id)

  return NextResponse.json({ messages: messages ?? [], participants: participants ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { content, sender_nickname, sender_fingerprint } = await req.json()

  if (!content || !sender_nickname || !sender_fingerprint) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: 'message too long' }, { status: 400 })
  }

  let supabase
  try { supabase = db() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { data: participant } = await supabase
    .from('dm_participants')
    .select('id, fingerprint')
    .eq('conversation_id', id)
    .eq('nickname', sender_nickname)
    .maybeSingle()

  if (!participant) {
    return NextResponse.json({ error: 'not a participant' }, { status: 403 })
  }

  if (!participant.fingerprint.startsWith('pending_') && participant.fingerprint !== sender_fingerprint) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (participant.fingerprint.startsWith('pending_')) {
    await supabase
      .from('dm_participants')
      .update({ fingerprint: sender_fingerprint })
      .eq('id', participant.id)
  }

  const { data: msg, error } = await supabase
    .from('dm_messages')
    .insert({ conversation_id: id, content, sender_nickname, sender_fingerprint })
    .select('id, sender_nickname, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('dm_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ message: msg }, { status: 201 })
}
