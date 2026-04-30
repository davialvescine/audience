# Claude — Project Instructions

This file is loaded automatically into every Claude session that runs in this repository. It documents conventions specific to the Audience project.

## Model preferences

**Use Claude Opus 4.7 (1M context) for all subagent dispatches.**

Pass `model: "opus"` to every `Agent` tool call. Reasoning:

- This project has many interlocking subsystems (Next.js + Supabase + pnpm workspaces + Bridge CLI). Subagents need broad context to make correct decisions on the first try.
- Migration tasks (e.g., Tailwind v3 → v4, Next 15 → 16) involve many files and edge cases. Sonnet often produces partial fixes; Opus handles end-to-end migrations cleanly.
- Cost is not a concern compared to the time lost to retry loops.

Use Sonnet only for trivial mechanical tasks (single config file with explicit contents, simple verification scripts). Default = Opus.

## Stack snapshot

- Monorepo: pnpm workspaces (`apps/*`, `packages/*`)
- Web: `apps/web` — Next.js 16 + React 19 + Tailwind CSS + Supabase + Sentry + Framer Motion + Vitest
- CLI: `packages/h2r-bridge` — Node 20+ ESM, Commander
- Shared: `packages/shared-types`, `packages/eslint-config`
- Database: Supabase hosted (`ogfalobvfofcrazaeydr`) — migrations in `supabase/migrations/` applied via `supabase db push`
- Auth: invite-only password (Supabase Auth admin API), magic link as fallback
- Deploy: Vercel (Root Directory `apps/web`); Bridge CLI publishes to npm
- Custom email templates managed via Supabase CLI (`supabase config push`) from `supabase/templates/`

## Working directory

All commands run from the monorepo root: `/Users/davialves/development/Audience/`.

## Patterns

- Brand tokens are CSS variables defined in `apps/web/app/globals.css`. Tailwind classes consume them. Per-event theming swaps the CSS vars via `<ThemeProvider>` from DB-stored theme records.
- Business logic lives in Postgres RPCs (security-definer functions). Server actions are thin wrappers that call RPCs and handle the H2R fetch.
- Dark mode: class strategy (`darkMode: 'class'`). `<ThemeToggle>` in root layout, persists choice to `localStorage`.
- Tests follow TDD where logic is non-trivial (validators, payload builders, RLS-protected RPCs).

## What NOT to do

- Don't run migrations destructively against the hosted Supabase — always `supabase db push` (additive). Add a new migration to revert if needed.
- Don't commit `apps/web/.env.local`. The file holds Supabase service-role key.
- Don't recreate the Vercel project unless the Root Directory metadata is wrong. Use the Vercel REST API (`PATCH /v9/projects/...`) to update settings in place when possible.
- Don't use `--no-verify` on git or skip CI gates.

## Session resume notes (last session: 2026-04-29 night)

When you re-open this project, read in order:
1. `MEMORY.md` index → start with `audience-pending.md` for the punch list
2. `docs/superpowers/plans/2026-04-30-telao-modes-multi.md` for the master plan (telão multi-mode)
3. `git log --oneline -10` to see recent commits

**Where we stopped:** ~95% of the multi-mode telão work shipped. 4 modes implemented (H2R, Browser Source, Chrome PiP all 100%; Audience Desktop is the only remaining piece). Autosave + multi-mode broadcast just landed.

**Next session must-do:** Start the Audience Desktop App. User picked MVP path (2 days, skip Mac Swift fullscreen workaround initially). Steps in `audience-pending.md` under "Recommended MVP path".

**Prerequisites already installed:** Rust toolchain (rustc 1.95.0, cargo 1.95.0). Just `cargo install tauri-cli` to add Tauri scaffolder.

**Production state:** Site live at https://audience-opal.vercel.app, Supabase hosted at ogfalobvfofcrazaeydr, all 13 migrations applied, first admin user already created. No outstanding production bugs as of last commit `29df6a5`.

**Key working decisions (don't re-debate):**
- Tailwind v4 with `@theme inline` + `--token-*` CSS vars (NOT classes for dynamic values; use inline style functions like `shadowStyle()`)
- Next 16 with Turbopack (not webpack flag)
- Inline `<script src="/theme-init.js">` in body (NOT `next/script` with `beforeInteractive` — that triggers React 19 + Turbopack errors)
- Chrome PiP via createPortal (NOT appendChild)
- Autosave 600ms debounce, no explicit save button
- Multi-mode broadcasts simultaneously (H2R via fetch + others via Realtime `status='sent'`)
- No Apple Developer Program — distribute desktop unsigned
