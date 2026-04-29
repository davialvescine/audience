# Audience

Multi-event web platform for moderated audience comments pushed live to H2R Graphics.

## Repo layout

- `apps/web` — Next.js web app (public form + admin moderation panel)
- `packages/h2r-bridge` — Node CLI run on the H2R Graphics machine
- `packages/shared-types` — TypeScript types shared across apps and packages
- `packages/eslint-config` — shared ESLint config
- `supabase/` — DB migrations and seeds

## Setup

1. `pnpm install`
2. `cp .env.example .env.local` and fill values
3. `pnpm dev` (runs apps/web)

See `docs/superpowers/specs/` for the design spec and `docs/superpowers/plans/` for the implementation plan.

## Production deployment

### Web app (Vercel)
1. Import repo in Vercel, set root to `apps/web`
2. Set env vars from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` (production project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (encrypted)
   - `IP_HASH_SALT` (32+ random chars)
   - `NEXT_PUBLIC_SITE_URL` (your domain)
   - `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (optional)
   - `RESEND_API_KEY` (optional — Supabase default email used otherwise)
3. Deploy

### Supabase production
1. Project already linked: `ogfalobvfofcrazaeydr`
2. Migrations in `supabase/migrations/` are applied via `supabase db push`
3. Auth → URL config → set Redirect URLs to `https://<domain>/auth/callback`
4. SMTP: configure Resend (or use Supabase default for low volume)

### Bridge CLI npm publish
1. `cd packages/h2r-bridge`
2. `pnpm build`
3. `npm login` (need account with publish access to `@ucob` org on npm)
4. `npm publish --access public`
5. Verify with `npx @ucob/h2r-bridge --version` from a clean shell

### Pre-event checklist
- [ ] Test full flow on staging (one event end-to-end including bridge CLI)
- [ ] Verify Sentry receives a test error (if DSN set)
- [ ] Confirm Supabase backup enabled (Settings → Database → Backups)
- [ ] Print QR code with public URL, place at venue
- [ ] Brief operator on runbook (`docs/runbooks/incidente-evento-ao-vivo.md`)
- [ ] Confirm cloudflared works on H2R machine (firewall, antivirus)
