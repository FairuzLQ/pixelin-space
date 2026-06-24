import { createClient } from '@supabase/supabase-js'

export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error(`Missing env: ${!url ? 'NEXT_PUBLIC_SUPABASE_URL' : 'SUPABASE_SERVICE_KEY'}`)
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
