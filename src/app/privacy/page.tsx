import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'privacy policy',
  description:
    'What pixelin.space collects (a hashed IP and browser fingerprint for anti-abuse), why, how long it is kept, and your choices. No accounts, no emails.',
  alternates: { canonical: '/privacy' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 flex flex-col gap-2">
      <h2 className="display text-lg" style={{ color: 'var(--ink)' }}>{title}</h2>
      <div className="text-sm leading-relaxed flex flex-col gap-2" style={{ color: 'var(--ink)' }}>
        {children}
      </div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-1.5" aria-label="pixelin.space home">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-sm"
            style={{ background: 'var(--accent)', border: '2.5px solid var(--ink)', boxShadow: 'var(--shadow-sm)' }}
            aria-hidden
          >✷</span>
          <span className="display text-lg" style={{ color: 'var(--ink)' }}>pixelin</span>
        </Link>
        <Link href="/" className="btn-ghost text-xs ml-auto">← back to feed</Link>
      </header>

      <div>
        <h1 className="display text-3xl" style={{ color: 'var(--ink)' }}>privacy policy</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text2)' }}>
          short version: no accounts, no emails, everything auto-deletes weekly.
        </p>
      </div>

      <Section title="what we collect">
        <ul className="flex flex-col gap-1.5 list-disc pl-5">
          <li><strong>Your nickname</strong> — the name you choose. It is public.</li>
          <li><strong>What you post</strong> — text, images, comments, reactions, and DM messages.</li>
          <li>
            <strong>A hashed IP address</strong> — your IP is one-way hashed (we never store the raw IP)
            and kept only to detect and stop abuse.
          </li>
          <li>
            <strong>A browser fingerprint</strong> — a short identifier derived from your browser, used
            to tie your nickname to your session, enforce limits, and block abusive devices.
          </li>
        </ul>
        <p>We do <strong>not</strong> collect your name, email, phone number, or precise location.</p>
      </Section>

      <Section title="why we collect it">
        <p>
          Only to run the service and keep it safe: showing your posts, powering DMs, preventing
          impersonation and spam, rate-limiting, and blocking users who break the{' '}
          <Link href="/about" className="linkified">rules</Link>.
        </p>
      </Section>

      <Section title="how long we keep it">
        <p>
          Everything is temporary. Posts, comments, reactions, DMs, and nickname claims are
          <strong> automatically deleted about a week after they&apos;re created</strong> by a scheduled
          cleanup. Admins may also remove content sooner.
        </p>
      </Section>

      <Section title="storage on your device">
        <p>
          We use your browser&apos;s <strong>local storage</strong> (not tracking cookies) to remember your
          nickname, your session identifier, your reactions, and which posts you&apos;ve saved. Clearing your
          browser storage removes these.
        </p>
      </Section>

      <Section title="who we share it with">
        <p>
          We don&apos;t sell your data. Data is stored with our infrastructure providers
          (<a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="linkified">Vercel</a>{' '}
          for hosting and{' '}
          <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="linkified">Supabase</a>{' '}
          for the database and image storage) solely to operate the service. We currently run{' '}
          <strong>no third-party advertising or analytics</strong>. If that ever changes, this page will be
          updated first.
        </p>
      </Section>

      <Section title="your choices">
        <p>
          You can delete your own posts and comments at any time. You can leave at any time — just stop
          using the site, and your content will expire on the weekly cycle. Questions or removal requests:{' '}
          <a href="mailto:abuse@pixelin.space" className="linkified">abuse@pixelin.space</a>.
        </p>
      </Section>

      <Section title="children">
        <p>
          pixelin.space is intended for users aged 13+ (or the minimum digital age where you live). We
          don&apos;t knowingly collect data from children under that age.
        </p>
      </Section>

      <footer className="flex items-center gap-3 justify-center py-4 text-xs" style={{ color: 'var(--text2)' }}>
        <Link href="/" className="linkified">feed</Link>
        <span>·</span>
        <Link href="/about" className="linkified">about &amp; rules</Link>
      </footer>
    </main>
  )
}
