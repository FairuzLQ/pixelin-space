import type { Metadata } from 'next'
import Link from 'next/link'
import { StarEgg } from '@/components/EasterEggs'

export const metadata: Metadata = {
  title: 'the answer',
  robots: { index: false, follow: false },
}

export default function TheAnswer() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md flex flex-col items-center gap-5 text-center">
        <StarEgg
          label="forty-two"
          className="display leading-none animate-pop"
          style={{ fontSize: '5.5rem', color: 'var(--ink)', background: 'transparent', cursor: 'pointer' }}
        >
          42
        </StarEgg>

        <p className="text-sm" style={{ color: 'var(--ink)' }}>
          the answer to life, the universe, and everything.
        </p>
        <p className="text-xs" style={{ color: 'var(--text2)' }}>
          you found a secret corner of the space. it, too, resets every week ✷
        </p>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="chip text-xs" style={{ background: 'var(--lime)' }}>you were curious</span>
          <span className="chip text-xs" style={{ background: 'var(--pink)' }}>we like that</span>
        </div>

        <Link href="/" className="btn-primary text-sm px-5 py-3">← back to the feed</Link>

        <p className="mono text-xs" style={{ color: 'var(--text2)' }}>
          tip: tap the 42 · or open the console and run pixelin.help()
        </p>
      </div>
    </main>
  )
}
