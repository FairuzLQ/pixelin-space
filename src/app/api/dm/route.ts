import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import { isBlocked, ownsNickname, rateLimit, validateNickname, normalizeNickname } from '@/lib/apiGuards'

function db() {
  try { return adminDb() } catch { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fingerprint = searchParams.get('fingerprint')
  const nickname = searchParams.get('nickname')
  // full=1 -> enriched list (participants + last message) for the /dm page.
  // default -> minimal (id + last_message_at) for the navbar unread poll, which
  // runs every 30s per user; keeping it cheap avoids N+1 blowup at scale.
  const full = searchParams.get('full') === '1'
  if (!fingerprint) return NextResponse.json({ error: 'missing fingerprint' }, { status: 400 })

  const supabase = db()
  if (!supabase) return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })

  // two separate parameterized queries — no string interpolation into filter values
  const q1 = supabase.from('dm_participants').select('conversation_id').eq('fingerprint', fingerprint)
  const q2 = nickname
    ? supabase.from('dm_participants').select('conversation_id').eq('fingerprint', `pending_${normalizeNickname(nickname)}`)
    : null

  const [r1, r2] = await Promise.all([q1, q2 ?? Promise.resolve({ data: [] })])
  const convIds = [
    ...((r1.data ?? []).map(p => p.conversation_id)),
    ...((r2.data ?? []).map(p => p.conversation_id)),
  ].filter((id, i, arr) => arr.indexOf(id) === i) // dedup

  if (convIds.length === 0) return NextResponse.json({ conversations: [] })

  const { data: convs } = await supabase
    .from('dm_conversations')
    .select('id, last_message_at')
    .in('id', convIds)
    .order('last_message_at', { ascending: false })

  // cheap path: navbar only needs last_message_at to compute the unread dot
  if (!full) return NextResponse.json({ conversations: convs ?? [] })

  // enriched path: two batched queries instead of 2 per conversation
  const [{ data: parts }, { data: msgs }] = await Promise.all([
    supabase.from('dm_participants').select('conversation_id, nickname').in('conversation_id', convIds),
    supabase.from('dm_messages')
      .select('conversation_id, content, sender_nickname, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false }),
  ])

  const partsByConv: Record<string, { nickname: string }[]> = {}
  for (const p of parts ?? []) (partsByConv[p.conversation_id] ??= []).push({ nickname: p.nickname })

  const lastByConv: Record<string, { content: string; sender_nickname: string; created_at: string }> = {}
  for (const m of msgs ?? []) {
    if (!lastByConv[m.conversation_id]) {
      lastByConv[m.conversation_id] = { content: m.content, sender_nickname: m.sender_nickname, created_at: m.created_at }
    }
  }

  const result = (convs ?? []).map(conv => ({
    ...conv,
    participants: partsByConv[conv.id] ?? [],
    last_message: lastByConv[conv.id] ?? null,
  }))

  return NextResponse.json({ conversations: result })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }

  const inviter_fingerprint = typeof body.inviter_fingerprint === 'string' ? body.inviter_fingerprint : ''
  const inviter_nickname = validateNickname(body.inviter_nickname)
  const rawInvitees = Array.isArray(body.invitee_nicknames) ? body.invitee_nicknames : []
  const invitee_nicknames = rawInvitees
    .map(n => validateNickname(n))
    .filter((n): n is string => !!n && n.toLowerCase() !== inviter_nickname?.toLowerCase())

  if (!inviter_fingerprint || !inviter_nickname || invitee_nicknames.length === 0) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (1 + invitee_nicknames.length > 3) {
    return NextResponse.json({ error: 'max 3 participants' }, { status: 400 })
  }

  const supabase = db()
  if (!supabase) return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })

  if (!(await ownsNickname(supabase, inviter_nickname, inviter_fingerprint))) {
    return NextResponse.json({ error: 'identity_mismatch' }, { status: 403 })
  }
  if (await isBlocked(supabase, inviter_fingerprint)) {
    return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }
  if (!(await rateLimit(supabase, `dmnew:${inviter_fingerprint}`, 10, 60 * 60_000))) {
    return NextResponse.json({ error: 'slow_down' }, { status: 429 })
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
      fingerprint: 'pending_' + nick.toLowerCase(),
    })
  }

  return NextResponse.json({ conversation_id: conv.id }, { status: 201 })
}
