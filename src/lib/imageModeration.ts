// Server-side image moderation via Sightengine (nudity + gore detection).
// You can't tell gore/NSFW from a file extension, so we send the bytes to a
// classifier before storing. It's OPT-IN: if the API keys aren't set the check
// is skipped and uploads work as before. Add these env vars to enable it:
//   SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET   (free tier at sightengine.com)

export type ModerationResult = { ok: true } | { ok: false; reason: string }

// tune to taste — higher = more permissive
const NUDITY_THRESHOLD = 0.5
const GORE_THRESHOLD = 0.5

export async function moderateImage(file: File): Promise<ModerationResult> {
  const user = process.env.SIGHTENGINE_API_USER
  const secret = process.env.SIGHTENGINE_API_SECRET
  if (!user || !secret) return { ok: true } // not configured → skip

  try {
    const form = new FormData()
    form.append('media', file)
    form.append('models', 'nudity-2.1,gore-2.0')
    form.append('api_user', user)
    form.append('api_secret', secret)

    const res = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: form,
    })
    const data = await res.json()

    if (data.status !== 'success') {
      // fail-open: don't block uploads if the moderation service errors out
      console.error('[moderation] sightengine non-success:', data.error ?? data.status)
      return { ok: true }
    }

    const n = data.nudity ?? {}
    const nudity = Math.max(n.sexual_activity ?? 0, n.sexual_display ?? 0, n.erotica ?? 0)
    if (nudity >= NUDITY_THRESHOLD) return { ok: false, reason: 'nudity' }

    const gore = data.gore?.prob ?? 0
    if (gore >= GORE_THRESHOLD) return { ok: false, reason: 'gore' }

    return { ok: true }
  } catch (e) {
    console.error('[moderation] error:', e)
    return { ok: true } // fail-open on network/parse errors
  }
}
