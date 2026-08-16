import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'about & rules',
  description:
    'What pixelin.space is, the community rules, safety guidance, and how moderation works. An anonymous space that resets every week.',
  alternates: { canonical: '/about' },
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

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 items-start">
      <span className="chip text-xs mt-0.5 shrink-0" style={{ background: 'var(--accent)' }} aria-hidden>✷</span>
      <span>{children}</span>
    </li>
  )
}

export default function AboutPage() {
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
        <h1 className="display text-3xl" style={{ color: 'var(--ink)' }}>about &amp; rules</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text2)' }}>
          please read before you post — this keeps the space usable for everyone.
        </p>
      </div>

      <Section title="what is this?">
        <p>
          <strong>pixelin.space</strong> is a tiny anonymous space. Pick a nickname — no account,
          no email — then post short thoughts, react, comment, and DM other people.
        </p>
        <p>
          Everything is temporary: <strong>posts, DMs, and nicknames reset every week.</strong>{' '}
          It&apos;s meant to be light, low-stakes, and a little chaotic — not a permanent record of anything.
        </p>
      </Section>

      <Section title="the rules — keep it chill">
        <ul className="flex flex-col gap-2">
          <Rule>Be decent. No harassment, bullying, threats, or hate speech.</Rule>
          <Rule>No doxxing. Don&apos;t post anyone&apos;s private info (yours or others&apos;).</Rule>
          <Rule>
            No illegal content. <strong>Absolutely no sexual content involving minors</strong> —
            it&apos;s removed and reported to authorities, no exceptions.
          </Rule>
          <Rule>No NSFW, gore, or shock content. Keep it safe for everyone.</Rule>
          <Rule>No spam, scams, phishing, or unsolicited ads.</Rule>
          <Rule>No impersonation. Your nickname is yours for the week — don&apos;t pretend to be someone else.</Rule>
          <Rule>Don&apos;t attack the service: no scraping, flooding, or exploiting bugs.</Rule>
        </ul>
      </Section>

      <Section title="stay safe">
        <ul className="flex flex-col gap-2">
          <Rule>It&apos;s anonymous and <strong>public</strong> — assume anyone can read what you post.</Rule>
          <Rule>
            DMs are private to their participants but are <strong>not end-to-end encrypted</strong>.
            Never share passwords, OTPs, card numbers, or anything sensitive.
          </Rule>
          <Rule>Don&apos;t share personal information that could identify you or others.</Rule>
          <Rule>If someone makes you uncomfortable, stop replying and report them.</Rule>
        </ul>
      </Section>

      <Section title="moderation & enforcement">
        <p>
          Admins can remove any content and block abusive users or devices. Breaking the rules means
          your content is deleted and your device may be blocked. We keep a hashed IP and a browser
          fingerprint with posts and comments purely to handle abuse — see the{' '}
          <Link href="/privacy" className="linkified">privacy policy</Link> for details.
        </p>
      </Section>

      <Section title="report abuse">
        <p>
          See something that breaks the rules? Email{' '}
          <a href="mailto:abuse@pixelin.space" className="linkified">abuse@pixelin.space</a>{' '}
          with a link or a screenshot and we&apos;ll look into it. Anything involving a minor&apos;s
          safety is prioritized and escalated.
        </p>
      </Section>

      <Section title="the fine print">
        <p>
          pixelin.space hosts <strong>user-generated content</strong>. Opinions and posts belong to the
          people who wrote them, not the operator, and the service is provided &quot;as is&quot; without warranty.
          Intended for users aged 13+ (or the minimum digital age where you live). By entering the space,
          you agree to these rules and to the{' '}
          <Link href="/privacy" className="linkified">privacy policy</Link>.
        </p>
      </Section>

      <footer className="flex items-center gap-3 justify-center py-4 text-xs" style={{ color: 'var(--text2)' }}>
        <Link href="/" className="linkified">feed</Link>
        <span>·</span>
        <Link href="/privacy" className="linkified">privacy</Link>
      </footer>
    </main>
  )
}
