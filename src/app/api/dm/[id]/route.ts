import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const since = new URL(req.url).searchParams.get('since')
  const supabase = db()

  let msgQuery = supabase
    .from('dm_messages')
    .select('id, sender_nickname, content, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (since) msgQuery = msgQuery.gt('created_at', since)

  const { data: messages, error } = await msgQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // participants only needed on first load (no since param)
  if (since) {
    return NextResponse.json({ messages: messages ?? [] })
  }

  const { data: participants } = await supabase
    .from('dm_participants')
    .select('nickname, fingerprint')
    .eq('conversation_id', id)

  return NextResponse.json({ messages: messages ?? [], participants: participants ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { content, sender_nickname, sender_fingerprint } = await req.json()

  if (!content || !sender_nickname || !sender_fingerprint) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const supabase = db()

  const { data: participant } = await supabase
    .from('dm_participants')
    .select('id, fingerprint')
    .eq('conversation_id', id)
    .eq('nickname', sender_nickname)
    .maybeSingle()

  if (!participant) {
    return NextResponse.json({ error: 'not a participant' }, { status: 403 })
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
