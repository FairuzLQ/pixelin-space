import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/supabaseAdmin'
import {
  anonDb, getIp, hashIp, rateLimit, validateNickname, normalizeNickname, WEEK_MS,
} from '@/lib/apiGuards'
import { hasProfanity } from '@/lib/wordFilter'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }) }

  const display = validateNickname(body.nickname)
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : ''

  if (!display || !fingerprint) {
    return NextResponse.json({ error: 'invalid nickname' }, { status: 400 })
  }
  if (hasProfanity(display)) {
    return NextResponse.json({ error: 'inappropriate nickname' }, { status: 400 })
  }
  const nickname = normalizeNickname(display)

  let db
  try { db = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // limit claims per IP so nobody can squat every nickname at reset time
  const ipHash = hashIp(getIp(req))
  if (!(await rateLimit(db, `claim:${ipHash}`, 12, 60 * 60_000))) {
    return NextResponse.json({ error: 'slow_down' }, { status: 429 })
  }

  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()

  const { data: existing } = await db
    .from('nickname_claims')
    .select('fingerprint, claimed_at')
    .eq('nickname', nickname)
    .maybeSingle()

  if (existing) {
    const isExpired = existing.claimed_at < weekAgo
    const isMine = existing.fingerprint === fingerprint

    if (!isMine && !isExpired) {
      return NextResponse.json({ error: 'taken' }, { status: 409 })
    }

    await db
      .from('nickname_claims')
      .update({ fingerprint, claimed_at: new Date().toISOString() })
      .eq('nickname', nickname)
    return NextResponse.json({ ok: true })
  }

  const { error } = await db
    .from('nickname_claims')
    .insert({ nickname, fingerprint, claimed_at: new Date().toISOString() })

  // unique-constraint race: someone claimed it between our check and insert
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'taken' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('nickname')
  const display = validateNickname(raw)
  if (!display) return NextResponse.json({ available: false, error: 'invalid' }, { status: 200 })

  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  const { data } = await anonDb()
    .from('nickname_claims')
    .select('claimed_at')
    .eq('nickname', normalizeNickname(display))
    .maybeSingle()

  const available = !data || data.claimed_at < weekAgo
  return NextResponse.json({ available })
}
