import { createHash } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only helpers shared across API routes: identity binding, rate limiting,
// input validation, and IP hashing. Centralising these removes the copy-pasted
// anonDb()/hashIp()/getIp() that used to live in every route.

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// A loosely-typed client is fine here — these tables aren't in the generated
// Database type and every call goes through the service-role key.
export type Db = SupabaseClient

export function anonDb(): Db {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ---------------------------------------------------------------- IP / hashing
export function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? 'pixelin_salt_2024'
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 16)
}

// ------------------------------------------------------------------- nicknames
// Display form keeps case; identity/ownership is always compared lowercased.
const DISPLAY_NICK_RE = /^[A-Za-z0-9_.]{2,20}$/
const RESERVED = new Set([
  'admin', 'administrator', 'system', 'sys', 'mod', 'moderator', 'root',
  'pixelin', 'official', 'support', 'staff', 'null', 'undefined', 'anon',
])

/** Returns the trimmed display nickname if valid, else null. */
export function validateNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!DISPLAY_NICK_RE.test(t)) return null
  if (RESERVED.has(t.toLowerCase())) return null
  return t
}

export function normalizeNickname(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * The core anti-impersonation check. A fingerprint may only act as a nickname
 * it actually holds in nickname_claims (and that hasn't expired). Without this,
 * anyone could POST { nickname: "someoneElse", fingerprint: "mine" }.
 */
export async function ownsNickname(db: Db, nickname: string, fingerprint: string): Promise<boolean> {
  if (!nickname || !fingerprint) return false
  const n = normalizeNickname(nickname)
  const { data } = await db
    .from('nickname_claims')
    .select('fingerprint, claimed_at')
    .eq('nickname', n)
    .maybeSingle()
  if (!data) return false
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  if (data.claimed_at < weekAgo) return false
  return data.fingerprint === fingerprint
}

// --------------------------------------------------------------------- blocked
export async function isBlocked(db: Db, fingerprint: string | null | undefined): Promise<boolean> {
  if (!fingerprint) return false
  const { data } = await db
    .from('blocked_fingerprints')
    .select('id')
    .eq('fingerprint', fingerprint)
    .maybeSingle()
  return !!data
}

// ----------------------------------------------------------------- rate limits
/**
 * Sliding-window rate limit backed by the rate_events table. Returns true if
 * the action is allowed (and records it), false if the caller is over the limit.
 * Sliding-log (one row per event) avoids the races of a shared counter; old
 * rows are swept by the weekly cron.
 */
export async function rateLimit(db: Db, bucket: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString()
  const { count } = await db
    .from('rate_events')
    .select('id', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .gte('created_at', since)
  if ((count ?? 0) >= limit) return false
  await db.from('rate_events').insert({ bucket })
  return true
}
