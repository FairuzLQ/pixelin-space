import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminDb } from '@/lib/supabaseAdmin'

function anonDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

const WEEK = 7 * 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const { nickname, fingerprint } = await req.json()
  if (!nickname || !fingerprint) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  let db
  try { db = adminDb() } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const weekAgo = new Date(Date.now() - WEEK).toISOString()

  const { data: existing } = await db
    .from('nickname_claims')
    .select('fingerprint, claimed_at')
    .eq('nickname', nickname.toLowerCase())
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
      .eq('nickname', nickname.toLowerCase())
    return NextResponse.json({ ok: true })
  }

  await db
    .from('nickname_claims')
    .insert({ nickname: nickname.toLowerCase(), fingerprint, claimed_at: new Date().toISOString() })

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const nickname = searchParams.get('nickname')
  if (!nickname) return NextResponse.json({ error: 'missing nickname' }, { status: 400 })

  const weekAgo = new Date(Date.now() - WEEK).toISOString()
  const { data } = await anonDb()
    .from('nickname_claims')
    .select('claimed_at')  // fingerprint omitted — not needed for availability check
    .eq('nickname', nickname.toLowerCase())
    .maybeSingle()

  const available = !data || data.claimed_at < weekAgo
  return NextResponse.json({ available })
}
