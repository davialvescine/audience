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
