import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/dm?fingerprint=xxx — list conversations for a fingerprint
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fingerprint = searchParams.get('fingerprint')
  if (!fingerprint) return NextResponse.json({ error: 'missing fingerprint' }, { status: 400 })

  const { data: participations } = await supabase
    .from('dm_participants')
    .select('conversation_id')
    .eq('fingerprint', fingerprint)

  const convIds = participations?.map(p => p.conversation_id) ?? []
  if (convIds.length === 0) return NextResponse.json({ conversations: [] })

  const { data: convs } = await supabase
    .from('dm_conversations')
    .select('id, last_message_at')
    .in('id', convIds)
    .order('last_message_at', { ascending: false })

  const result = await Promise.all(
    (convs ?? []).map(async (conv) => {
      const { data: participants } = await supabase
        .from('dm_participants')
        .select('nickname, fingerprint')
        .eq('conversation_id', conv.id)

      const { data: lastMsg } = await supabase
        .from('dm_messages')
        .select('content, sender_nickname, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return { ...conv, participants: participants ?? [], last_message: lastMsg }
    })
  )

  return NextResponse.json({ conversations: result })
}

// POST /api/dm — create new conversation
export async function POST(req: NextRequest) {
  const { inviter_nickname, inviter_fingerprint, invitee_nicknames } = await req.json()

  if (!inviter_fingerprint || !inviter_nickname || !invitee_nicknames?.length) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const totalParticipants = 1 + invitee_nicknames.length
  if (totalParticipants > 3) {
    return NextResponse.json({ error: 'max 3 participants' }, { status: 400 })
  }

  const { data: conv, error } = await supabase
    .from('dm_conversations')
    .insert({ last_message_at: new Date().toISOString() })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('dm_participants').insert({
    conversation_id: conv.id,
    nickname: inviter_nickname,
    fingerprint: inviter_fingerprint,
  })

  for (const nick of invitee_nicknames) {
    await supabase.from('dm_participants').insert({
      conversation_id: conv.id,
      nickname: nick,
      fingerprint: 'pending_' + nick,
    })
  }

  return NextResponse.json({ conversation_id: conv.id }, { status: 201 })
}
