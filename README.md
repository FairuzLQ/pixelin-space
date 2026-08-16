# pixelin.space

A tiny **anonymous** social space. Pick a nickname (no account, no email), post,
react, comment, and DM. Everything — nicknames, posts, DMs — **resets every week**.

Built with **Next.js 16** (App Router, Turbopack) + **Supabase** (Postgres, Storage,
Realtime). Deployed on Vercel.

> Note: this repo runs a Next.js version with breaking changes vs. older docs
> (e.g. middleware is now `proxy.ts`). See `AGENTS.md`.

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind v4
- Supabase JS (service-role for all writes, anon key for public reads only)
- Design: neo-brutalist "sticker" system (paper + ink, chunky borders, hard shadows)

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
```

### 1. Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...        # your project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon key (shipped to browser; read-only via RLS)
SUPABASE_SERVICE_KEY=...            # service role key (server only — all writes)
ADMIN_USERNAME=...                  # /admin login
ADMIN_PASSWORD=...
ADMIN_SECRET=...                    # HMAC secret for the admin session cookie
IP_HASH_SALT=...                    # optional; salt for hashed IPs
CRON_SECRET=...                     # Bearer token for /api/cron/cleanup
```

### 2. Run the database migration ⚠️ required

Open the Supabase SQL editor and run **`supabase_schema.sql`**. It's idempotent
(safe to re-run) and creates all tables, indexes, RLS policies, the storage bucket,
and the realtime publication.

**This step is mandatory.** The app selects the `posts.edited_at` column and uses the
`rate_events` table; without the migration the feed and rate limiting will error.

## Security model

Because there are no accounts, identity is a **weekly nickname claim** bound to a
browser **fingerprint**:

- `nickname_claims` is the source of truth. Claiming a free nickname records
  `(nickname → fingerprint)` for 7 days.
- Every write (post / comment / DM) verifies the caller's fingerprint actually
  **owns** the nickname it's posting under (`ownsNickname`) — this blocks
  impersonation.
- DMs to someone use a `pending_<nickname>` slot; the real owner can only claim it
  by proving nickname ownership, which blocks conversation hijacking.
- All mutations go through the **service-role** key on the server. The browser's
  anon key can only *read* public data (RLS allows select-only where appropriate;
  DMs, blocks, and `rate_events` have no anon access at all).
- Sliding-window **rate limits** (`rate_events`) on posts, comments, reactions,
  DMs, uploads, and nickname claims.
- Uploads require an active identity, validate MIME + extension + size, and only
  ever store to the `post-images` bucket. Post `image_url`s are validated to point
  at that bucket.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  HSTS, `Permissions-Policy`) are set in `next.config.ts`.
- Admin routes are guarded server-side by a timing-safe HMAC session cookie with a
  7-day expiry; `proxy.ts` additionally gates the dashboard page.

## Weekly reset

`vercel.json` schedules `GET /api/cron/cleanup` every Sunday 00:00 UTC (auth via
`CRON_SECRET`) to delete data older than a week. Admins can also force a reset or
nuke all data from `/admin/dashboard`.

## Key routes

| Path | What |
|------|------|
| `/` | feed (new / top sort, search, #tags) |
| `/p/[id]` | single post permalink |
| `/tag/[tag]` | posts for a hashtag |
| `/saved` | locally-bookmarked posts |
| `/dm`, `/dm/[id]` | conversations |
| `/admin` | admin login + dashboard |
