import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isBlocked, ownsNickname, rateLimit, validateNickname } from '@/lib/apiGuards'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }

  const my_fingerprint = typeof body.my_fingerprint === 'string' ? body.my_fingerprint : ''
  const my_nickname = validateNickname(body.my_nickname)
  const target_nickname = validateNickname(body.target_nickname)

  if (!my_nickname || !my_fingerprint || !target_nickname) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (my_nickname.toLowerCase() === target_nickname.toLowerCase()) {
    return NextResponse.json({ error: 'cannot dm yourself' }, { status: 400 })
  }

  let supabase
  try { supabase = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // the opener must actually own the nickname they claim to be
  if (!(await ownsNickname(supabase, my_nickname, my_fingerprint))) {
    return NextResponse.json({ error: 'identity_mismatch' }, { status: 403 })
  }
  if (await isBlocked(supabase, my_fingerprint)) {
    return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }
  if (!(await rateLimit(supabase, `dmnew:${my_fingerprint}`, 10, 60 * 60_000))) {
    return NextResponse.json({ error: 'slow_down' }, { status: 429 })
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
  // (that would expose fingerprints and enable impersonation). The target proves
  // ownership of the pending slot when they first open/send in the conversation.
  const { data: conv, error } = await supabase
    .from('dm_conversations')
    .insert({ last_message_at: new Date().toISOString() })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('dm_participants').insert([
    { conversation_id: conv.id, nickname: my_nickname, fingerprint: my_fingerprint },
    { conversation_id: conv.id, nickname: target_nickname, fingerprint: 'pending_' + target_nickname.toLowerCase() },
  ])

  return NextResponse.json({ conversation_id: conv.id }, { status: 201 })
}
