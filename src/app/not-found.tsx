import type { Metadata } from 'next'
import Link from 'next/link'
import { StarEgg } from '@/components/EasterEggs'

export const metadata: Metadata = {
  title: 'lost in space (404)',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-sm flex flex-col items-center gap-5 text-center">
        <StarEgg
          label="✷"
          className="text-5xl leading-none animate-pop"
          style={{ background: 'transparent', cursor: 'pointer' }}
        >
          ✷
        </StarEgg>

        <div>
          <h1 className="display text-5xl" style={{ color: 'var(--ink)' }}>404</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--ink)' }}>
            this corner of the space doesn&apos;t exist —
          </p>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            or it already reset. everything here is temporary ✷
          </p>
        </div>

        <Link href="/" className="btn-primary text-sm px-5 py-3">← back to the feed</Link>

        <p className="mono text-xs" style={{ color: 'var(--text2)' }}>
          psst — some old cheat code still works around here.
        </p>
      </div>
    </main>
  )
}
