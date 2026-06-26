import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fingerprint = searchParams.get('fingerprint')
  if (!fingerprint) return NextResponse.json({ count: 0, limit: 3 })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await db()
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('fingerprint', fingerprint)
    .gte('created_at', weekAgo)

  return NextResponse.json({ count: count ?? 0, limit: 3 })
}
