// Server-side fire-and-forget broadcast to a Supabase Realtime channel.
// Topic must NOT include the "realtime:" prefix — matches client channel('name').
export function broadcastEvent(topic: string, event: string, payload: object) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [{ topic, event, payload, private: false }],
    }),
  }).catch(() => {})
}
