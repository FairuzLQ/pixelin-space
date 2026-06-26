import { createClient } from '@supabase/supabase-js'

let _instance: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (typeof window === 'undefined') return null
  if (!_instance) {
    _instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _instance
}
