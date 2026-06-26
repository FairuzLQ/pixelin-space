// Server-side broadcast to a Supabase Realtime channel.
// Topic must NOT include the "realtime:" prefix — matches client channel('name').
// Awaitable — callers must await this so the request fires before the function returns.
export async function broadcastEvent(topic: string, event: string, payload: object): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload, private: false }],
      }),
    })
    if (!res.ok) {
      console.error(`[broadcast] ${topic}/${event} failed: ${res.status}`)
    }
  } catch (e) {
    console.error(`[broadcast] ${topic}/${event} error:`, e)
  }
}
