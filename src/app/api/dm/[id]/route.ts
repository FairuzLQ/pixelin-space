import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

async function assertParticipant(supabase: ReturnType<typeof db>, convId: string, fingerprint: string, nickname: string): Promise<boolean> {
  // valid if real fingerprint matches OR the pending entry for this nickname exists
  const { data } = await supabase
    .from('dm_participants')
    .select('id')
    .eq('conversation_id', convId)
    .or(`fingerprint.eq.${fingerprint},fingerprint.eq.pending_${nickname}`)
    .limit(1)
    .maybeSingle()
  return data !== null
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

  const supabase = db()

  // verify caller is a participant
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

  // verify fingerprint — allow if pending (first message upgrades fingerprint) or already matches
  if (!participant.fingerprint.startsWith('pending_') && participant.fingerprint !== sender_fingerprint) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // upgrade pending fingerprint on first message
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

  // broadcast via Supabase Realtime REST — fire-and-forget, no WS connection needed
  // clients subscribed to channel `dm-<id>` receive this instantly
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [{ topic: `realtime:dm-${id}`, event: 'new-message', payload: msg }]
    }),
  }).catch(() => {})

  return NextResponse.json({ message: msg }, { status: 201 })
}
