import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const { my_nickname, my_fingerprint, target_nickname } = await req.json()
  if (!my_nickname || !my_fingerprint || !target_nickname) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (my_nickname === target_nickname) {
    return NextResponse.json({ error: 'cannot dm yourself' }, { status: 400 })
  }

  let supabase
  try { supabase = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // find existing 1-on-1 conversation between the two nicknames
  const { data: myConvs } = await supabase
    .from('dm_participants')
    .select('conversation_id')
    .eq('nickname', my_nickname)

  const myConvIds = myConvs?.map(p => p.conversation_id) ?? []

  if (myConvIds.length > 0) {
    const { data: shared } = await supabase
      .from('dm_participants')
      .select('conversation_id')
      .eq('nickname', target_nickname)
      .in('conversation_id', myConvIds)

    if (shared && shared.length > 0) {
      for (const s of shared) {
        const { count } = await supabase
          .from('dm_participants')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', s.conversation_id)
        if (count === 2) {
          return NextResponse.json({ conversation_id: s.conversation_id })
        }
      }
    }
  }

  // always use pending_ for new DM targets — never look up the target's fingerprint
  // from posts (that would expose fingerprints and enable impersonation)
  const { data: conv, error } = await supabase
    .from('dm_conversations')
    .insert({ last_message_at: new Date().toISOString() })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('dm_participants').insert([
    { conversation_id: conv.id, nickname: my_nickname, fingerprint: my_fingerprint },
    { conversation_id: conv.id, nickname: target_nickname, fingerprint: 'pending_' + target_nickname },
  ])

  return NextResponse.json({ conversation_id: conv.id }, { status: 201 })
}
