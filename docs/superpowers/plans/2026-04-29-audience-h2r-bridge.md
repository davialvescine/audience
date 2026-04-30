# Audience + H2R Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-event web platform where audiences submit moderated comments via public links, approved comments are pushed automatically to the H2R Graphics broadcast app via Cloudflare Tunnel, with a per-event theming system to swap colors per event with no code change.

**Architecture:** Monorepo (pnpm workspaces) with `apps/web` (Next.js 15 App Router + Supabase + Vercel) and `packages/h2r-bridge` (Node CLI npm package). Real-time moderation queue uses Supabase Realtime. CLI on the H2R machine spawns cloudflared and registers via one-time pairing code, eliminating manual URL configuration.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind 3.4 (CSS vars for theming), Supabase (Postgres + Auth + Realtime + RLS), pnpm workspaces, Vitest + Testing Library + Playwright, GitHub Actions CI, Sentry, Resend (magic link emails), `@anthropic-ai/sdk` not used here, `cloudflared` binary spawned by Node CLI.

**Spec:** `docs/superpowers/specs/2026-04-29-audience-h2r-bridge-design.md` (read first if you have not already).

---

## How to use this plan

1. Tasks are numbered sequentially across phases.
2. Each task lists Files, Steps (with checkboxes), exact commands, and full code where non-obvious.
3. **TDD is mandatory** for code with logic: write failing test → run it → implement minimum → run again → commit.
4. **Commit after each task** — small, frequent, descriptive.
5. **Phase complete when** all its tasks are checked AND CI is green.
6. Conventions: Conventional Commits, branches `feat/<feature>`/`fix/<bug>`, PR < 500 lines.

---

## Phase 0: Repository Foundation

Goal: working monorepo skeleton with TS, lint, format, CI passing on an empty PR. Phase complete when a no-op PR runs `pnpm lint && pnpm typecheck && pnpm build && pnpm test` green on GitHub Actions.

### Task 1: Initialize git repo and pnpm workspace

**Files:**
- Create: `/Users/davialves/development/Audience/.git/` (via `git init`)
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.nvmrc`

- [ ] **Step 1: Verify Node 20+ and pnpm installed**

```bash
node --version  # expect v20.x or higher
pnpm --version  # expect 9.x or higher; if missing: npm install -g pnpm
```

- [ ] **Step 2: Init git and base files**

```bash
cd /Users/davialves/development/Audience
git init -b main
echo "20" > .nvmrc
```

- [ ] **Step 3: Write root package.json**

```json
{
  "name": "audience-monorepo",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20", "pnpm": ">=9" },
  "scripts": {
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\""
  },
  "devDependencies": {
    "prettier": "^3.3.0",
    "typescript": "^5.6.0"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 4: Write pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 5: Write .gitignore**

```gitignore
node_modules/
.pnpm-store/
dist/
.next/
.turbo/
coverage/
.env
.env*.local
*.log
.DS_Store
.vercel
playwright-report/
test-results/
.cloudflared/
~/.ucob-h2r-bridge/
```

- [ ] **Step 6: Write .prettierrc**

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

Create `.prettierignore`:

```
node_modules
.next
dist
coverage
pnpm-lock.yaml
*.md
```

- [ ] **Step 7: Install root deps**

```bash
pnpm install
```

Expected: pnpm-lock.yaml generated, no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo with prettier and tooling"
```

---

### Task 2: Configure TypeScript baseline

**Files:**
- Create: `tsconfig.base.json` (shared base for all packages)

- [ ] **Step 1: Write tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"]
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore: add base TypeScript configuration"
```

---

### Task 3: Set up shared ESLint config

**Files:**
- Create: `packages/eslint-config/package.json`
- Create: `packages/eslint-config/index.js`

- [ ] **Step 1: Create shared ESLint package**

```bash
mkdir -p packages/eslint-config
```

`packages/eslint-config/package.json`:

```json
{
  "name": "@audience/eslint-config",
  "version": "0.0.1",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^8.8.0",
    "@typescript-eslint/parser": "^8.8.0",
    "eslint": "^9.12.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.30.0"
  }
}
```

`packages/eslint-config/index.js`:

```js
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: false,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    'import/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
  },
};
```

- [ ] **Step 2: Install and commit**

```bash
pnpm install
git add packages/eslint-config pnpm-lock.yaml
git commit -m "chore: add shared eslint config package"
```

---

### Task 4: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write ci.yml**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          SENTRY_DSN: ''
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: add GitHub Actions CI workflow"
```

---

### Task 5: .env.example and README skeleton

**Files:**
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Write .env.example**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Resend (magic link emails)
RESEND_API_KEY=

# Anti-spam
IP_HASH_SALT=

# Bridge CLI default config (optional override)
AUDIENCE_API_URL=https://audience.app
```

- [ ] **Step 2: Write README.md**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: add env example and README skeleton"
```

---

## Phase 1: Web App Scaffold

Goal: `apps/web` boots, renders a hello page, lints clean, types pass, builds for production.

### Task 6: Bootstrap Next.js 15 in apps/web

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`

- [ ] **Step 1: Create directory and files**

```bash
mkdir -p apps/web/app
```

`apps/web/package.json`:

```json
{
  "name": "@audience/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@audience/eslint-config": "workspace:*",
    "@types/node": "^22.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.12.0",
    "eslint-config-next": "15.0.0",
    "typescript": "^5.6.0"
  }
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { typedRoutes: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
```

`apps/web/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react';

import './globals.css';

export const metadata = {
  title: 'Audience',
  description: 'Live audience moderation for events',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/app/page.tsx`:

```tsx
export default function HomePage() {
  return <main className="p-8">Audience</main>;
}
```

`apps/web/app/globals.css`:

```css
:root {
  color-scheme: light;
}
* {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
```

`apps/web/.eslintrc.json`:

```json
{
  "extends": ["next/core-web-vitals", "@audience/eslint-config"]
}
```

- [ ] **Step 2: Install and verify**

```bash
pnpm install
cd apps/web && pnpm typecheck && pnpm build && cd ../..
```

Expected: build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): bootstrap Next.js 15 app scaffold"
```

---

### Task 7: Configure Tailwind 3.4 with CSS variables for theming

**Files:**
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.cjs`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/package.json` (add tailwind deps)

- [ ] **Step 1: Install Tailwind**

```bash
cd apps/web && pnpm add -D tailwindcss@3.4.13 postcss@8.4.47 autoprefixer@10.4.20 && cd ../..
```

- [ ] **Step 2: Write tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-deep': 'rgb(var(--color-primary-deep) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        display: 'var(--font-display)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Write postcss.config.cjs**

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 4: Update globals.css**

Replace `apps/web/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Default theme — overridden per event by ThemeProvider */
  --color-primary: 14 76 94;
  --color-primary-deep: 10 44 61;
  --color-accent: 245 197 24;
  --color-secondary: 110 69 182;
  --color-ink: 10 37 64;
  --color-paper: 255 255 255;
  --color-surface: 248 250 252;
  --color-success: 16 185 129;
  --color-danger: 239 68 68;
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1.25rem;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Inter', ui-sans-serif, system-ui, sans-serif;
  color-scheme: light;
}
* {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  background: rgb(var(--color-paper));
  color: rgb(var(--color-ink));
}
```

- [ ] **Step 5: Update page.tsx to test Tailwind**

```tsx
export default function HomePage() {
  return (
    <main className="bg-primary text-paper p-8 min-h-screen">
      <h1 className="text-4xl font-display">Audience</h1>
      <p className="text-accent">Tema base ativo.</p>
    </main>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
cd apps/web && pnpm build && cd ../..
```

- [ ] **Step 7: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): configure Tailwind with CSS-var-driven theming"
```

---

### Task 8: Add Vitest for web

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/vitest.setup.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install Vitest**

```bash
cd apps/web && pnpm add -D vitest@^2.1.0 @vitest/coverage-v8 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.5.0 jsdom@^25.0.0 && cd ../..
```

- [ ] **Step 2: vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: { reporter: ['text', 'html'], exclude: ['node_modules', '.next'] },
  },
  resolve: { alias: { '@': '/' } },
});
```

```bash
cd apps/web && pnpm add -D @vitejs/plugin-react@^4.3.0 && cd ../..
```

- [ ] **Step 3: vitest.setup.ts**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add a sanity test**

`apps/web/lib/__tests__/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

```bash
cd apps/web && pnpm test && cd ../..
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "test(web): set up vitest with jsdom and testing-library"
```

---

## Phase 2: Database Schema + Themes

Goal: Supabase project provisioned, all tables/enums/RLS/RPCs migrated, `geracao-2026` theme seeded, generated TS types in `packages/shared-types`.

### Task 9: Set up Supabase local dev

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Install Supabase CLI**

```bash
brew install supabase/tap/supabase
supabase --version  # expect 1.200+ or latest
```

- [ ] **Step 2: Initialize**

```bash
cd /Users/davialves/development/Audience
supabase init
```

This creates `supabase/config.toml`. Open and ensure `[auth].enable_signup = false` (we use magic link only).

- [ ] **Step 3: Append to .gitignore**

Add lines:

```
supabase/.branches/
supabase/.temp/
supabase/.env
```

- [ ] **Step 4: Start local Supabase**

```bash
supabase start
```

Expected: Postgres on port 54322, Studio on 54323. Note the `service_role key` and `anon key` from output.

- [ ] **Step 5: Save local creds to .env.local**

```bash
cp .env.example apps/web/.env.local
```

Fill `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and the anon/service keys printed by `supabase start`.

- [ ] **Step 6: Commit (no .env.local — gitignored)**

```bash
git add supabase .gitignore
git commit -m "chore: initialize supabase local dev"
```

---

### Task 10: Migration 0001 — themes table

**Files:**
- Create: `supabase/migrations/00010000_themes.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00010000_themes.sql
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tokens jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.themes enable row level security;

-- Themes are world-readable (we need to render public form with the theme)
create policy "themes_select_public" on public.themes for select using (true);

-- Only admins can write (future: super-admin role; for now, no insert via API)
-- Inserts happen via service role / migrations.
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db reset  # nukes local DB and reapplies all migrations
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.themes"
```

Expected: shows columns id, slug, name, tokens, created_at.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00010000_themes.sql
git commit -m "feat(db): add themes table with RLS"
```

---

### Task 11: Migration 0002 — events table + RLS

**Files:**
- Create: `supabase/migrations/00020000_events.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00020000_events.sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  theme_id uuid not null references public.themes(id),
  h2r_webhook_url text,
  h2r_source_id text,
  h2r_paired_at timestamptz,
  h2r_last_heartbeat timestamptz,
  submissions_open boolean not null default true,
  created_at timestamptz not null default now()
);

create index events_owner_idx on public.events(owner_id);
create index events_slug_idx on public.events(slug);

alter table public.events enable row level security;

-- Public can SELECT a minimal projection by slug — but we need to limit columns.
-- We expose only safe columns via a SECURITY DEFINER function below; raw table is not public.

create policy "events_owner_all" on public.events
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Public function to fetch event by slug — only safe columns
create or replace function public.get_event_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  theme_id uuid,
  submissions_open boolean
)
language sql
security definer
set search_path = public
as $$
  select id, slug, name, theme_id, submissions_open
  from public.events
  where slug = p_slug
  limit 1;
$$;

grant execute on function public.get_event_by_slug(text) to anon, authenticated;
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.events"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00020000_events.sql
git commit -m "feat(db): add events table with owner RLS and public lookup function"
```

---

### Task 12: Migration 0003 — submissions enum + table + RLS

**Files:**
- Create: `supabase/migrations/00030000_submissions.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00030000_submissions.sql
create type public.submission_status as enum ('pending', 'approved', 'rejected', 'sent', 'failed');

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  comment text not null check (char_length(comment) between 1 and 280),
  status public.submission_status not null default 'pending',
  ip_hash text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz,
  error_message text
);

create index submissions_event_status_idx on public.submissions(event_id, status, created_at desc);

alter table public.submissions enable row level security;

-- Owners of the event can do anything with their submissions
create policy "submissions_owner_all" on public.submissions
  for all
  using (
    exists (
      select 1 from public.events e
      where e.id = submissions.event_id and e.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = submissions.event_id and e.owner_id = auth.uid()
    )
  );

-- Public CANNOT read submissions directly. INSERT happens via RPC (next migration).
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/00030000_submissions.sql
git commit -m "feat(db): add submissions enum and table with owner RLS"
```

---

### Task 13: Migration 0004 — submit_comment RPC with rate limit

**Files:**
- Create: `supabase/migrations/00040000_submit_comment_rpc.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00040000_submit_comment_rpc.sql
create or replace function public.submit_comment(
  p_slug text,
  p_name text,
  p_comment text,
  p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_open boolean;
  v_count int;
  v_submission_id uuid;
begin
  -- Resolve event
  select id, submissions_open into v_event_id, v_open
  from public.events where slug = p_slug;

  if v_event_id is null then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  if not v_open then
    raise exception 'submissions_closed' using errcode = 'P0001';
  end if;

  -- Length checks
  if char_length(coalesce(p_name, '')) < 1 or char_length(p_name) > 60 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_comment, '')) < 1 or char_length(p_comment) > 280 then
    raise exception 'invalid_comment' using errcode = 'P0001';
  end if;

  -- Rate limit: max 5 submissions per ip_hash in last 60 seconds
  if p_ip_hash is not null then
    select count(*) into v_count
    from public.submissions
    where ip_hash = p_ip_hash
      and created_at > now() - interval '60 seconds';
    if v_count >= 5 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;

  insert into public.submissions (event_id, name, comment, ip_hash, status)
  values (v_event_id, p_name, p_comment, p_ip_hash, 'pending')
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

grant execute on function public.submit_comment(text, text, text, text) to anon, authenticated;
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/00040000_submit_comment_rpc.sql
git commit -m "feat(db): add submit_comment RPC with rate limit"
```

---

### Task 14: Migration 0005 — pairing_codes table

**Files:**
- Create: `supabase/migrations/00050000_pairing_codes.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00050000_pairing_codes.sql
create table public.pairing_codes (
  code text primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  heartbeat_secret text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index pairing_codes_event_idx on public.pairing_codes(event_id);

alter table public.pairing_codes enable row level security;

-- Owners can create pairing codes for their events
create policy "pairing_codes_owner_insert" on public.pairing_codes
  for insert
  with check (
    exists (select 1 from public.events e where e.id = pairing_codes.event_id and e.owner_id = auth.uid())
  );

create policy "pairing_codes_owner_select" on public.pairing_codes
  for select
  using (
    exists (select 1 from public.events e where e.id = pairing_codes.event_id and e.owner_id = auth.uid())
  );

-- redemption is via service role (CLI calls API; API uses service key)
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/00050000_pairing_codes.sql
git commit -m "feat(db): add pairing_codes table with RLS"
```

---

### Task 14b: Migration 0006 — moderation RPCs (approve/reject/retry)

**Why RPC:** keep state machine in Postgres so server actions can stay thin and transitions are atomic. The HTTP fetch to H2R still happens in Node (Postgres can't reliably do outbound HTTPS without `pg_net` overhead), but everything else — validation, status transitions, owner check, idempotency — is in SQL.

**Files:**
- Create: `supabase/migrations/00060000_moderation_rpcs.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00060000_moderation_rpcs.sql

-- Atomically transitions a pending submission to 'approved' and returns the
-- payload data the server action needs to POST to H2R. Idempotent: if not
-- pending, returns null row (caller handles).
create or replace function public.claim_submission_for_send(p_submission_id uuid)
returns table (
  submission_id uuid,
  event_id uuid,
  event_slug text,
  event_name text,
  display_name text,
  comment text,
  webhook_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  -- Verify ownership and that submission is pending
  select e.owner_id into v_owner
  from public.submissions s
  join public.events e on e.id = s.event_id
  where s.id = p_submission_id and s.status = 'pending';

  if v_owner is null then return; end if;
  if v_owner <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.submissions
    set status = 'approved', approved_at = now()
    where id = p_submission_id and status = 'pending';

  return query
    select s.id, s.event_id, e.slug, e.name, s.name, s.comment, e.h2r_webhook_url
    from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id;
end;
$$;

grant execute on function public.claim_submission_for_send(uuid) to authenticated;

create or replace function public.mark_submission_sent(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'sent', sent_at = now(), error_message = null
    where id = p_submission_id;
end;
$$;

grant execute on function public.mark_submission_sent(uuid) to authenticated;

create or replace function public.mark_submission_failed(p_submission_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'failed', error_message = p_error
    where id = p_submission_id;
end;
$$;

grant execute on function public.mark_submission_failed(uuid, text) to authenticated;

create or replace function public.reject_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'rejected'
    where id = p_submission_id and status in ('pending', 'failed');
end;
$$;

grant execute on function public.reject_submission(uuid) to authenticated;

create or replace function public.reset_submission_for_retry(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'pending', error_message = null, approved_at = null, sent_at = null
    where id = p_submission_id and status = 'failed';
end;
$$;

grant execute on function public.reset_submission_for_retry(uuid) to authenticated;
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select proname from pg_proc where proname like '%submission%' or proname like '%submit%';"
```

Expected: lists `submit_comment`, `claim_submission_for_send`, `mark_submission_sent`, `mark_submission_failed`, `reject_submission`, `reset_submission_for_retry`.

- [ ] **Step 3: Regenerate types**

```bash
pnpm db:types
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00060000_moderation_rpcs.sql packages/shared-types/src/database.ts
git commit -m "feat(db): add moderation RPCs (claim, mark_sent, mark_failed, reject, reset)"
```

---

### Task 14c: Migration 0007 — pairing RPCs (redeem + heartbeat)

**Why RPC:** redeem touches 2 tables (events + pairing_codes) and must be atomic. Heartbeat needs secret validation in the same query. Moving both to RPCs makes the API routes thin proxies.

**Files:**
- Create: `supabase/migrations/00070000_pairing_rpcs.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00070000_pairing_rpcs.sql

create or replace function public.redeem_pairing_code(
  p_code text,
  p_tunnel_url text,
  p_source_id text
)
returns table (event_id uuid, event_name text, heartbeat_secret text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.pairing_codes;
  v_event_id uuid;
  v_webhook_url text;
  v_now timestamptz := now();
begin
  select * into v_code from public.pairing_codes where code = p_code;
  if v_code is null then
    raise exception 'code_not_found' using errcode = 'P0001';
  end if;
  if v_code.consumed_at is not null then
    raise exception 'code_consumed' using errcode = 'P0001';
  end if;
  if v_code.expires_at < v_now then
    raise exception 'code_expired' using errcode = 'P0001';
  end if;

  v_event_id := v_code.event_id;
  v_webhook_url := rtrim(p_tunnel_url, '/') || '/data/' || p_source_id;

  update public.events
    set h2r_webhook_url = v_webhook_url,
        h2r_source_id = p_source_id,
        h2r_paired_at = v_now,
        h2r_last_heartbeat = v_now
    where id = v_event_id;

  update public.pairing_codes
    set consumed_at = v_now
    where code = p_code;

  return query
    select e.id, e.name, v_code.heartbeat_secret
    from public.events e
    where e.id = v_event_id;
end;
$$;

-- Service role only (CLI-facing API uses service key)
revoke all on function public.redeem_pairing_code(text, text, text) from public, anon, authenticated;
grant execute on function public.redeem_pairing_code(text, text, text) to service_role;

create or replace function public.record_heartbeat(p_event_id uuid, p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
begin
  select exists (
    select 1 from public.pairing_codes
    where event_id = p_event_id and heartbeat_secret = p_secret
  ) into v_valid;

  if not v_valid then return false; end if;

  update public.events
    set h2r_last_heartbeat = now()
    where id = p_event_id;

  return true;
end;
$$;

revoke all on function public.record_heartbeat(uuid, text) from public, anon, authenticated;
grant execute on function public.record_heartbeat(uuid, text) to service_role;
```

- [ ] **Step 2: Apply, regen types, commit**

```bash
supabase db reset
pnpm db:types
git add supabase/migrations/00070000_pairing_rpcs.sql packages/shared-types/src/database.ts
git commit -m "feat(db): add pairing RPCs (redeem_pairing_code, record_heartbeat)"
```

---

### Task 15: Seed geracao-2026 theme

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write seed**

```sql
-- seed.sql
insert into public.themes (slug, name, tokens) values (
  'geracao-2026',
  'Geração 2026 — O Nascer de Uma Geração',
  jsonb_build_object(
    'colors', jsonb_build_object(
      'primary', '14 76 94',
      'primaryDeep', '10 44 61',
      'accent', '245 197 24',
      'secondary', '110 69 182',
      'ink', '10 37 64',
      'paper', '255 255 255',
      'surface', '248 250 252',
      'success', '16 185 129',
      'danger', '239 68 68'
    ),
    'radius', jsonb_build_object('sm', '0.375rem', 'md', '0.75rem', 'lg', '1.25rem'),
    'font', jsonb_build_object(
      'sans', 'Inter, ui-sans-serif, system-ui, sans-serif',
      'display', 'Inter, ui-sans-serif, system-ui, sans-serif'
    )
  )
)
on conflict (slug) do update set tokens = excluded.tokens, name = excluded.name;
```

Note: colors stored as `R G B` triplets (no commas) so Tailwind `rgb(var(--color-primary) / <alpha-value>)` resolves correctly.

- [ ] **Step 2: Apply via reset**

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select slug, name from public.themes;"
```

Expected: `geracao-2026 | Geração 2026 — O Nascer de Uma Geração`

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed geracao-2026 theme"
```

---

### Task 16: Generate TypeScript types

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/database.ts` (generated)
- Modify: root `package.json` — add `db:types` script

- [ ] **Step 1: Create shared-types package**

```bash
mkdir -p packages/shared-types/src
```

`packages/shared-types/package.json`:

```json
{
  "name": "@audience/shared-types",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "echo skip",
    "build": "echo skip",
    "test": "echo skip"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

`packages/shared-types/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"]
}
```

`packages/shared-types/src/index.ts`:

```ts
export * from './database';

export type ThemeTokens = {
  colors: {
    primary: string;
    primaryDeep: string;
    accent: string;
    secondary: string;
    ink: string;
    paper: string;
    surface: string;
    success: string;
    danger: string;
  };
  radius: { sm: string; md: string; lg: string };
  font: { sans: string; display: string };
};

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'sent' | 'failed';

export type H2RPayload = {
  messages: Array<{
    id: string;
    timestamp: number;
    snippet: { displayMessage: string };
    authorDetails: { displayName: string; profileImageUrl: string };
    platform: { name: string; logoUrl: string };
  }>;
};
```

- [ ] **Step 2: Generate database types**

```bash
supabase gen types typescript --local > packages/shared-types/src/database.ts
```

- [ ] **Step 3: Add root script for regeneration**

In root `package.json` scripts add:

```json
"db:types": "supabase gen types typescript --local > packages/shared-types/src/database.ts"
```

- [ ] **Step 4: Install and commit**

```bash
pnpm install
git add packages/shared-types pnpm-lock.yaml package.json
git commit -m "feat(types): add shared-types package with generated db types"
```

---

## Phase 3: Theming System

Goal: theme tokens flow from `themes.tokens` JSON in DB to CSS variables on the rendered page; designing system primitives consume them via Tailwind classes.

### Task 17: Theme provider component (TDD)

**Files:**
- Create: `apps/web/components/ui/ThemeProvider.tsx`
- Create: `apps/web/components/ui/__tests__/ThemeProvider.test.tsx`
- Create: `apps/web/lib/themes/buildThemeStyle.ts`
- Create: `apps/web/lib/themes/__tests__/buildThemeStyle.test.ts`

- [ ] **Step 1: Write failing test for buildThemeStyle**

`apps/web/lib/themes/__tests__/buildThemeStyle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { buildThemeStyle } from '../buildThemeStyle';
import type { ThemeTokens } from '@audience/shared-types';

const tokens: ThemeTokens = {
  colors: {
    primary: '14 76 94',
    primaryDeep: '10 44 61',
    accent: '245 197 24',
    secondary: '110 69 182',
    ink: '10 37 64',
    paper: '255 255 255',
    surface: '248 250 252',
    success: '16 185 129',
    danger: '239 68 68',
  },
  radius: { sm: '0.375rem', md: '0.75rem', lg: '1.25rem' },
  font: { sans: 'Inter', display: 'Inter' },
};

describe('buildThemeStyle', () => {
  it('emits CSS custom properties for every color token', () => {
    const style = buildThemeStyle(tokens);
    expect(style['--color-primary']).toBe('14 76 94');
    expect(style['--color-accent']).toBe('245 197 24');
    expect(style['--color-danger']).toBe('239 68 68');
  });

  it('emits radius variables', () => {
    const style = buildThemeStyle(tokens);
    expect(style['--radius-md']).toBe('0.75rem');
  });

  it('emits font variables', () => {
    const style = buildThemeStyle(tokens);
    expect(style['--font-sans']).toBe('Inter');
    expect(style['--font-display']).toBe('Inter');
  });

  it('camelCase keys become kebab-case CSS vars', () => {
    const style = buildThemeStyle(tokens);
    expect(style['--color-primary-deep']).toBe('10 44 61');
  });
});
```

- [ ] **Step 2: Add @audience/shared-types to web deps**

Edit `apps/web/package.json` dependencies:

```json
"@audience/shared-types": "workspace:*"
```

```bash
pnpm install
```

- [ ] **Step 3: Run test → fails**

```bash
cd apps/web && pnpm test --run lib/themes && cd ../..
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement buildThemeStyle**

`apps/web/lib/themes/buildThemeStyle.ts`:

```ts
import type { ThemeTokens } from '@audience/shared-types';

const camelToKebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export function buildThemeStyle(tokens: ThemeTokens): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.colors)) {
    style[`--color-${camelToKebab(key)}`] = value;
  }
  for (const [key, value] of Object.entries(tokens.radius)) {
    style[`--radius-${key}`] = value;
  }
  style['--font-sans'] = tokens.font.sans;
  style['--font-display'] = tokens.font.display;
  return style;
}
```

- [ ] **Step 5: Run tests → pass**

```bash
cd apps/web && pnpm test --run lib/themes && cd ../..
```

Expected: 4 tests pass.

- [ ] **Step 6: Implement ThemeProvider**

`apps/web/components/ui/ThemeProvider.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { ThemeTokens } from '@audience/shared-types';

import { buildThemeStyle } from '@/lib/themes/buildThemeStyle';

type Props = { tokens: ThemeTokens; children: ReactNode };

export function ThemeProvider({ tokens, children }: Props) {
  const style = buildThemeStyle(tokens) as React.CSSProperties;
  return (
    <div style={style} className="contents">
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Test ThemeProvider renders style**

`apps/web/components/ui/__tests__/ThemeProvider.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ThemeProvider } from '../ThemeProvider';

const tokens = {
  colors: {
    primary: '14 76 94',
    primaryDeep: '10 44 61',
    accent: '245 197 24',
    secondary: '110 69 182',
    ink: '10 37 64',
    paper: '255 255 255',
    surface: '248 250 252',
    success: '16 185 129',
    danger: '239 68 68',
  },
  radius: { sm: '0.375rem', md: '0.75rem', lg: '1.25rem' },
  font: { sans: 'Inter', display: 'Inter' },
};

describe('ThemeProvider', () => {
  it('injects CSS variables on its container', () => {
    const { container } = render(
      <ThemeProvider tokens={tokens}>
        <span>hi</span>
      </ThemeProvider>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('14 76 94');
    expect(root.style.getPropertyValue('--radius-md')).toBe('0.75rem');
  });
});
```

```bash
cd apps/web && pnpm test --run && cd ../..
```

- [ ] **Step 8: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add ThemeProvider with CSS-variable injection"
```

---

### Task 18: Supabase clients

**Files:**
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/browser.ts`
- Create: `apps/web/lib/supabase/service.ts`

- [ ] **Step 1: Install Supabase deps**

```bash
cd apps/web && pnpm add @supabase/ssr@^0.5.0 @supabase/supabase-js@^2.45.0 && cd ../..
```

- [ ] **Step 2: Server client (cookies-aware)**

`apps/web/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@audience/shared-types';

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Browser client**

`apps/web/lib/supabase/browser.ts`:

```ts
'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@audience/shared-types';

export function getSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: Service client (server-only, uses service_role)**

`apps/web/lib/supabase/service.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@audience/shared-types';

export function getSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add supabase clients (server, browser, service)"
```

---

## Phase 4: Design System Primitives

Goal: 9 reusable UI components with tests, all using only theme tokens (no Tailwind palette literals like `bg-blue-500`).

### Task 19: Button component

**Files:**
- Create: `apps/web/components/ui/Button.tsx`
- Create: `apps/web/components/ui/__tests__/Button.test.tsx`

- [ ] **Step 1: Write failing tests**

`apps/web/components/ui/__tests__/Button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Button } from '../Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders disabled', () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading state and is non-interactive', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button loading onClick={onClick}>x</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies primary variant by default', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-primary/);
  });

  it('applies accent variant', () => {
    render(<Button variant="accent">x</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-accent/);
  });
});
```

```bash
cd apps/web && pnpm add -D @testing-library/user-event@^14.5.0 && cd ../..
```

- [ ] **Step 2: Run → fail**

```bash
cd apps/web && pnpm test --run components/ui/__tests__/Button && cd ../..
```

- [ ] **Step 3: Implement Button**

`apps/web/components/ui/Button.tsx`:

```tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: 'bg-primary text-paper hover:bg-primary-deep',
  accent: 'bg-accent text-ink hover:brightness-95',
  ghost: 'bg-transparent text-ink hover:bg-surface',
  danger: 'bg-danger text-paper hover:brightness-90',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-sm',
  md: 'h-11 px-5 text-base rounded-md',
  lg: 'h-14 px-7 text-lg rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className = '', children, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...rest}
    >
      {loading ? <span aria-hidden>…</span> : null}
      {children}
    </button>
  );
});
```

- [ ] **Step 4: Run → pass**

```bash
cd apps/web && pnpm test --run components/ui/__tests__/Button && cd ../..
```

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(ui): add Button primitive with variants and loading state"
```

---

### Task 20: Input + Textarea

**Files:**
- Create: `apps/web/components/ui/Input.tsx`
- Create: `apps/web/components/ui/Textarea.tsx`
- Create: `apps/web/components/ui/__tests__/Input.test.tsx`
- Create: `apps/web/components/ui/__tests__/Textarea.test.tsx`

- [ ] **Step 1: Write failing test for Input**

`apps/web/components/ui/__tests__/Input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Input } from '../Input';

describe('Input', () => {
  it('renders label associated with input', () => {
    render(<Input label="Nome" id="name" />);
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Input label="Nome" id="name" error="obrigatório" />);
    expect(screen.getByText('obrigatório')).toBeInTheDocument();
  });

  it('marks aria-invalid when error present', () => {
    render(<Input label="Nome" id="name" error="x" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
```

- [ ] **Step 2: Implement Input**

`apps/web/components/ui/Input.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helper?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, helper, id, className = '', ...rest },
  ref,
) {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helper ? `${id}-helper` : undefined;
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        className={`mt-1 block w-full h-11 px-3 rounded-md border border-ink/20 bg-paper text-ink placeholder:text-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${error ? 'border-danger' : ''} ${className}`}
        {...rest}
      />
      {helper ? (
        <span id={helperId} className="mt-1 block text-xs text-ink/60">
          {helper}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
});
```

- [ ] **Step 3: Implement Textarea (mirrors Input but with character counter)**

`apps/web/components/ui/__tests__/Textarea.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('shows character count when maxLength set', () => {
    render(<Textarea label="x" id="c" maxLength={280} value="hello" onChange={() => {}} />);
    expect(screen.getByText('5 / 280')).toBeInTheDocument();
  });
});
```

`apps/web/components/ui/Textarea.tsx`:

```tsx
import { forwardRef, type TextareaHTMLAttributes } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  helper?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, error, helper, id, value, maxLength, className = '', ...rest },
  ref,
) {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helper ? `${id}-helper` : undefined;
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <textarea
        ref={ref}
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        className={`mt-1 block w-full min-h-32 px-3 py-2 rounded-md border border-ink/20 bg-paper text-ink placeholder:text-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${error ? 'border-danger' : ''} ${className}`}
        {...rest}
      />
      <div className="mt-1 flex justify-between text-xs">
        <span id={helperId} className="text-ink/60">
          {helper}
        </span>
        {maxLength ? (
          <span className="text-ink/60">
            {length} / {maxLength}
          </span>
        ) : null}
      </div>
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
});
```

- [ ] **Step 4: Run all tests, commit**

```bash
cd apps/web && pnpm test --run && cd ../..
git add apps/web
git commit -m "feat(ui): add Input and Textarea primitives with validation states"
```

---

### Task 21: Card, Badge, EmptyState, LoadingSkeleton, ErrorBoundary, BrandHeader

**Files:**
- Create: `apps/web/components/ui/Card.tsx`
- Create: `apps/web/components/ui/Badge.tsx`
- Create: `apps/web/components/ui/EmptyState.tsx`
- Create: `apps/web/components/ui/LoadingSkeleton.tsx`
- Create: `apps/web/components/ui/ErrorBoundary.tsx`
- Create: `apps/web/components/ui/BrandHeader.tsx`
- Create: matching `__tests__` files for each

- [ ] **Step 1: Card**

`apps/web/components/ui/Card.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function Card({ children, className = '', ...rest }: Props) {
  return (
    <div className={`bg-paper rounded-lg border border-ink/10 shadow-sm p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Badge**

`apps/web/components/ui/Badge.tsx`:

```tsx
import type { ReactNode } from 'react';

import type { SubmissionStatus } from '@audience/shared-types';

const map: Record<SubmissionStatus, { label: string; cls: string }> = {
  pending: { label: 'Aguardando', cls: 'bg-surface text-ink' },
  approved: { label: 'Aprovado', cls: 'bg-secondary/15 text-secondary' },
  rejected: { label: 'Rejeitado', cls: 'bg-danger/15 text-danger' },
  sent: { label: 'No telão', cls: 'bg-success/15 text-success' },
  failed: { label: 'Falhou', cls: 'bg-danger/15 text-danger' },
};

export function Badge({ status }: { status: SubmissionStatus }) {
  const { label, cls } = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${cls}`}>{label}</span>
  );
}

export function CustomBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${className}`}>{children}</span>;
}
```

- [ ] **Step 3: EmptyState**

`apps/web/components/ui/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react';

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div role="status" className="text-center py-12 px-4">
      {icon ? <div className="mx-auto mb-4 text-ink/40">{icon}</div> : null}
      <h2 className="text-lg font-display font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-2 text-sm text-ink/60">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: LoadingSkeleton**

`apps/web/components/ui/LoadingSkeleton.tsx`:

```tsx
type Props = { className?: string; lines?: number };

export function LoadingSkeleton({ className = '', lines = 1 }: Props) {
  return (
    <div role="status" aria-label="Carregando" className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-surface rounded animate-pulse mb-2 last:mb-0" />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: ErrorBoundary**

`apps/web/components/ui/ErrorBoundary.tsx`:

```tsx
'use client';

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    if (typeof window !== 'undefined' && (window as { Sentry?: { captureException: (e: Error, c?: unknown) => void } }).Sentry) {
      (window as { Sentry: { captureException: (e: Error, c?: unknown) => void } }).Sentry.captureException(error, {
        contexts: { react: info },
      });
    }
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div role="alert" className="p-6 bg-surface rounded-lg">
            <h2 className="text-lg font-semibold text-danger">Algo deu errado.</h2>
            <p className="mt-2 text-sm text-ink/70">Tente recarregar a página.</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 6: BrandHeader**

`apps/web/components/ui/BrandHeader.tsx`:

```tsx
import type { ReactNode } from 'react';

type Props = { title: string; subtitle?: string; children?: ReactNode };

export function BrandHeader({ title, subtitle, children }: Props) {
  return (
    <header className="bg-gradient-to-b from-primary to-accent text-paper px-6 py-10 md:py-14">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-display font-bold leading-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-lg opacity-90">{subtitle}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </header>
  );
}
```

- [ ] **Step 7: Add minimal smoke tests for the rest**

`apps/web/components/ui/__tests__/Card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from '../Card';
describe('Card', () => {
  it('renders children', () => {
    render(<Card>x</Card>);
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});
```

(Replicate the pattern for Badge, EmptyState, LoadingSkeleton, BrandHeader — each at least 1 test confirming render.)

`apps/web/components/ui/__tests__/EmptyState.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmptyState } from '../EmptyState';
describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Vazio" description="Nada aqui ainda" />);
    expect(screen.getByText('Vazio')).toBeInTheDocument();
    expect(screen.getByText('Nada aqui ainda')).toBeInTheDocument();
  });
});
```

`apps/web/components/ui/__tests__/Badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from '../Badge';
describe('Badge', () => {
  it('renders correct label per status', () => {
    render(<Badge status="sent" />);
    expect(screen.getByText('No telão')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run tests, commit**

```bash
cd apps/web && pnpm test --run && cd ../..
git add apps/web
git commit -m "feat(ui): add Card, Badge, EmptyState, LoadingSkeleton, ErrorBoundary, BrandHeader"
```

---

### Task 22: /admin/ui-kit showcase page

**Files:**
- Create: `apps/web/app/admin/ui-kit/page.tsx`

- [ ] **Step 1: Implement showcase page**

```tsx
import { Badge } from '@/components/ui/Badge';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Textarea } from '@/components/ui/Textarea';

export default function UiKitPage() {
  return (
    <div className="min-h-screen bg-surface">
      <BrandHeader title="UI Kit" subtitle="Showcase do design system" />
      <main className="max-w-3xl mx-auto py-8 px-6 space-y-8">
        <Card>
          <h2 className="text-xl font-display mb-4">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-display mb-4">Inputs</h2>
          <div className="space-y-4">
            <Input label="Nome" id="name" placeholder="João" />
            <Input label="Email" id="email" error="formato inválido" />
            <Textarea label="Comentário" id="c" maxLength={280} defaultValue="hello" />
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-display mb-4">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge status="pending" />
            <Badge status="approved" />
            <Badge status="rejected" />
            <Badge status="sent" />
            <Badge status="failed" />
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-display mb-4">EmptyState</h2>
          <EmptyState title="Nenhuma submissão" description="Quando alguém enviar, aparece aqui." />
        </Card>

        <Card>
          <h2 className="text-xl font-display mb-4">LoadingSkeleton</h2>
          <LoadingSkeleton lines={3} />
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd apps/web && pnpm dev
```

Navigate to <http://localhost:3000/admin/ui-kit> in mobile viewport (Chrome devtools 375px). All components render correctly with theme colors.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(web): add /admin/ui-kit showcase page"
```

---

## Phase 5: Public Form

Goal: anonymous user visits `/e/<slug>`, sees themed form, submits name+comment, sees confirmation. Rate-limited at the DB level.

### Task 23: Submission validators

**Files:**
- Create: `apps/web/lib/validators/submission.ts`
- Create: `apps/web/lib/validators/__tests__/submission.test.ts`

- [ ] **Step 1: Install zod**

```bash
cd apps/web && pnpm add zod@^3.23.0 && cd ../..
```

- [ ] **Step 2: Write failing tests**

`apps/web/lib/validators/__tests__/submission.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { submissionSchema, sanitizeText } from '../submission';

describe('submissionSchema', () => {
  it('accepts valid input', () => {
    expect(submissionSchema.safeParse({ name: 'João', comment: 'Tudo bem!' }).success).toBe(true);
  });
  it('rejects empty name', () => {
    expect(submissionSchema.safeParse({ name: '', comment: 'x' }).success).toBe(false);
  });
  it('rejects 281-char comment', () => {
    expect(submissionSchema.safeParse({ name: 'a', comment: 'a'.repeat(281) }).success).toBe(false);
  });
  it('rejects 61-char name', () => {
    expect(submissionSchema.safeParse({ name: 'a'.repeat(61), comment: 'x' }).success).toBe(false);
  });
});

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('<b>oi</b>')).toBe('oi');
  });
  it('collapses whitespace', () => {
    expect(sanitizeText('  hi   there  ')).toBe('hi there');
  });
  it('strips zero-width characters', () => {
    expect(sanitizeText('a​b')).toBe('ab');
  });
});
```

- [ ] **Step 3: Implement**

`apps/web/lib/validators/submission.ts`:

```ts
import { z } from 'zod';

export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const submissionSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome obrigatório')
    .max(60, 'Máximo 60 caracteres')
    .transform(sanitizeText)
    .refine((v) => v.length >= 1, 'Nome obrigatório após limpeza'),
  comment: z
    .string()
    .min(1, 'Comentário obrigatório')
    .max(280, 'Máximo 280 caracteres')
    .transform(sanitizeText)
    .refine((v) => v.length >= 1, 'Comentário obrigatório após limpeza'),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
```

- [ ] **Step 4: Run tests, commit**

```bash
cd apps/web && pnpm test --run lib/validators && cd ../..
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add submission validators with sanitization"
```

---

### Task 24: submitComment server action

**Files:**
- Create: `apps/web/lib/security/ipHash.ts`
- Create: `apps/web/server-actions/submitComment.ts`

- [ ] **Step 1: IP hash helper**

`apps/web/lib/security/ipHash.ts`:

```ts
import { createHash } from 'node:crypto';

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? '';
  return createHash('sha256').update(`${ip}|${salt}`).digest('hex');
}
```

- [ ] **Step 2: submitComment action**

`apps/web/server-actions/submitComment.ts`:

```ts
'use server';

import { headers } from 'next/headers';

import { hashIp } from '@/lib/security/ipHash';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { submissionSchema } from '@/lib/validators/submission';

type Result = { ok: true; submissionId: string } | { ok: false; error: string };

export async function submitComment(slug: string, formData: FormData): Promise<Result> {
  const parsed = submissionSchema.safeParse({
    name: formData.get('name'),
    comment: formData.get('comment'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = hashIp(ip);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc('submit_comment', {
    p_slug: slug,
    p_name: parsed.data.name,
    p_comment: parsed.data.comment,
    p_ip_hash: ipHash,
  });

  if (error) {
    const code = error.message;
    if (code.includes('rate_limited')) return { ok: false, error: 'Muitas mensagens em pouco tempo. Aguarde um instante.' };
    if (code.includes('submissions_closed')) return { ok: false, error: 'Submissões encerradas para este evento.' };
    if (code.includes('event_not_found')) return { ok: false, error: 'Evento não encontrado.' };
    return { ok: false, error: 'Não foi possível enviar. Tente novamente.' };
  }

  return { ok: true, submissionId: data as string };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(web): add submitComment server action"
```

---

### Task 25: SubmissionForm client component

**Files:**
- Create: `apps/web/components/audience/SubmissionForm.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useState, useTransition } from 'react';

import { submitComment } from '@/server-actions/submitComment';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

type Props = { slug: string };

export function SubmissionForm({ slug }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');

  if (success) {
    return (
      <div role="status" className="text-center p-6 bg-paper rounded-lg shadow-sm">
        <h2 className="text-2xl font-display text-primary">Recebido!</h2>
        <p className="mt-2 text-ink/70">Seu comentário foi enviado e pode aparecer no telão.</p>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        start(async () => {
          const result = await submitComment(slug, formData);
          if (!result.ok) setError(result.error);
          else {
            setSuccess(true);
            setName('');
            setComment('');
          }
        });
      }}
      className="space-y-4"
    >
      <Input
        label="Seu nome"
        id="name"
        name="name"
        required
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Como você quer aparecer no telão"
      />
      <Textarea
        label="Sua mensagem"
        id="comment"
        name="comment"
        required
        maxLength={280}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escreva aqui…"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Enviar
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web
git commit -m "feat(audience): add SubmissionForm client component"
```

---

### Task 26: /e/[slug] page (Server Component)

**Files:**
- Create: `apps/web/app/(public)/e/[slug]/page.tsx`
- Create: `apps/web/app/(public)/e/[slug]/not-found.tsx`
- Create: `apps/web/lib/themes/loadTheme.ts`

- [ ] **Step 1: Theme loader (with cache)**

`apps/web/lib/themes/loadTheme.ts`:

```ts
import { cache } from 'react';

import type { ThemeTokens } from '@audience/shared-types';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

export const loadTheme = cache(async (themeId: string): Promise<ThemeTokens | null> => {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase.from('themes').select('tokens').eq('id', themeId).single();
  return (data?.tokens as ThemeTokens) ?? null;
});
```

- [ ] **Step 2: Public event page**

`apps/web/app/(public)/e/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';

import { SubmissionForm } from '@/components/audience/SubmissionForm';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Card } from '@/components/ui/Card';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { loadTheme } from '@/lib/themes/loadTheme';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

type Params = { slug: string };

export default async function PublicEventPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const supabase = getSupabaseServiceClient();
  const { data: events } = await supabase.rpc('get_event_by_slug', { p_slug: slug });
  const event = events?.[0];
  if (!event) notFound();

  const theme = await loadTheme(event.theme_id);
  if (!theme) notFound();

  return (
    <ThemeProvider tokens={theme}>
      <div className="min-h-screen bg-surface">
        <BrandHeader title={event.name} subtitle="Mande sua mensagem para o telão" />
        <main className="max-w-md mx-auto px-4 py-8 -mt-8 relative z-10">
          <Card>
            {event.submissions_open ? (
              <SubmissionForm slug={event.slug} />
            ) : (
              <p className="text-center text-ink/60">Submissões encerradas.</p>
            )}
          </Card>
        </main>
      </div>
    </ThemeProvider>
  );
}
```

`apps/web/app/(public)/e/[slug]/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-display">Evento não encontrado</h1>
        <p className="mt-2 text-ink/60">Verifique o link recebido.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Manual test**

Create an event manually via SQL for testing:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<SQL
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'test@example.com');
insert into public.events (slug, name, owner_id, theme_id)
  select 'teste-2026', 'Teste', '00000000-0000-0000-0000-000000000001', id from public.themes where slug = 'geracao-2026';
SQL
```

```bash
cd apps/web && pnpm dev
```

Navigate to <http://localhost:3000/e/teste-2026>. Verify themed form renders, submit a message, see confirmation. Submit 6 in a row → 6th rejected with rate limit message.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(audience): add public event page with themed submission form"
```

---

## Phase 6: Admin Auth + Events Management

Goal: owner can log in via magic link, create events, see their list, configure settings.

### Task 27: Magic link login

**Files:**
- Create: `apps/web/app/admin/page.tsx`
- Create: `apps/web/app/auth/callback/route.ts`
- Create: `apps/web/server-actions/auth.ts`

- [ ] **Step 1: Login page**

`apps/web/app/admin/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

import { signInWithEmail } from '@/server-actions/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminLoginPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/admin/events');

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-display mb-6">Entrar no Audience</h1>
        <form action={signInWithEmail} className="space-y-4">
          <Input label="Seu e-mail" id="email" name="email" type="email" required />
          <Button type="submit" className="w-full">
            Enviar link mágico
          </Button>
        </form>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Auth action**

`apps/web/server-actions/auth.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return;
  const supabase = await getSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  redirect('/admin?sent=1');
}

export async function signOut() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/admin');
}
```

- [ ] **Step 3: OAuth callback**

`apps/web/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/admin/events', url));
}
```

- [ ] **Step 4: Add NEXT_PUBLIC_SITE_URL to .env.example**

Append: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

- [ ] **Step 5: Commit**

```bash
git add apps/web .env.example
git commit -m "feat(auth): add magic link login + callback handler"
```

---

### Task 28: Auth guard helper

**Files:**
- Create: `apps/web/lib/auth/requireUser.ts`

- [ ] **Step 1: Implement**

```ts
import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin');
  return user;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web
git commit -m "feat(auth): add requireUser server-side guard"
```

---

### Task 29: createEvent server action

**Files:**
- Create: `apps/web/lib/validators/event.ts`
- Create: `apps/web/server-actions/createEvent.ts`

- [ ] **Step 1: Validator**

```ts
import { z } from 'zod';

export const eventSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'apenas letras minúsculas, números e hífens'),
  themeId: z.string().uuid(),
});
```

- [ ] **Step 2: Action**

`apps/web/server-actions/createEvent.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { eventSchema } from '@/lib/validators/event';

type Result = { ok: true; slug: string } | { ok: false; error: string };

export async function createEvent(formData: FormData): Promise<Result> {
  const user = await requireUser();
  const parsed = eventSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    themeId: formData.get('themeId'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('events')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      theme_id: parsed.data.themeId,
      owner_id: user.id,
    })
    .select('slug')
    .single();

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Esse slug já está em uso. Escolha outro.' };
    return { ok: false, error: 'Não foi possível criar o evento.' };
  }
  redirect(`/admin/events/${data.slug}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(events): add createEvent action with slug validation"
```

---

### Task 30: /admin/events list and /admin/events/new

**Files:**
- Create: `apps/web/app/admin/events/page.tsx`
- Create: `apps/web/app/admin/events/new/page.tsx`
- Create: `apps/web/components/audience/AdminShell.tsx`

- [ ] **Step 1: AdminShell layout**

`apps/web/components/audience/AdminShell.tsx`:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

import { signOut } from '@/server-actions/auth';

type Props = { children: ReactNode; userEmail: string };

export function AdminShell({ children, userEmail }: Props) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-paper border-b border-ink/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin/events" className="font-display text-lg text-primary">
            Audience
          </Link>
          <form action={signOut} className="flex items-center gap-3">
            <span className="text-sm text-ink/60">{userEmail}</span>
            <button type="submit" className="text-sm text-ink/70 hover:text-danger">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Events list page**

`apps/web/app/admin/events/page.tsx`:

```tsx
import Link from 'next/link';

import { AdminShell } from '@/components/audience/AdminShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminEventsPage() {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, name, h2r_paired_at, h2r_last_heartbeat')
    .order('created_at', { ascending: false });

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Eventos</h1>
        <Link href="/admin/events/new">
          <Button>+ Novo evento</Button>
        </Link>
      </div>
      {events && events.length > 0 ? (
        <div className="grid gap-4">
          {events.map((e) => (
            <Card key={e.id}>
              <Link href={`/admin/events/${e.slug}`} className="block">
                <h2 className="font-display text-lg text-ink">{e.name}</h2>
                <p className="text-sm text-ink/60">/e/{e.slug}</p>
                {e.h2r_paired_at ? (
                  <p className="mt-2 text-xs text-success">✓ H2R conectado</p>
                ) : (
                  <p className="mt-2 text-xs text-ink/40">⚠ H2R não conectado</p>
                )}
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum evento ainda"
          description="Crie o primeiro pra começar a receber comentários."
          action={
            <Link href="/admin/events/new">
              <Button>+ Novo evento</Button>
            </Link>
          }
        />
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 3: New event wizard**

`apps/web/app/admin/events/new/page.tsx`:

```tsx
import { AdminShell } from '@/components/audience/AdminShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { createEvent } from '@/server-actions/createEvent';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function NewEventPage() {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data: themes } = await supabase.from('themes').select('id, slug, name');

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <h1 className="text-2xl font-display mb-6">Novo evento</h1>
      <Card>
        <form action={createEvent} className="space-y-4">
          <Input label="Nome do evento" id="name" name="name" required maxLength={100} />
          <Input
            label="Slug da URL"
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9-]+"
            helper="Aparece em audience.app/e/<slug>. Apenas minúsculas, números e hífens."
          />
          <label htmlFor="themeId" className="block">
            <span className="text-sm font-medium text-ink">Tema visual</span>
            <select
              id="themeId"
              name="themeId"
              required
              className="mt-1 block w-full h-11 px-3 rounded-md border border-ink/20 bg-paper text-ink"
              defaultValue={themes?.[0]?.id}
            >
              {themes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="w-full">Criar evento</Button>
        </form>
      </Card>
    </AdminShell>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(events): add events list and new event wizard"
```

---

## Phase 7: Pairing Flow (web)

Goal: web side of pairing — generate code, display it for operator, accept redemption from CLI.

### Task 31: Pairing code generator action

**Files:**
- Create: `apps/web/lib/security/pairingCode.ts`
- Create: `apps/web/lib/security/__tests__/pairingCode.test.ts`
- Create: `apps/web/server-actions/generatePairingCode.ts`

- [ ] **Step 1: Test code generator**

```ts
import { describe, it, expect } from 'vitest';

import { generatePairingCode, generateHeartbeatSecret } from '../pairingCode';

describe('generatePairingCode', () => {
  it('matches AUDIENCE-XXXX-XXXX with alphanumerics', () => {
    const code = generatePairingCode();
    expect(code).toMatch(/^AUDIENCE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
  it('generates unique codes', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generatePairingCode()));
    expect(set.size).toBe(1000);
  });
});

describe('generateHeartbeatSecret', () => {
  it('produces 64-hex-char string', () => {
    expect(generateHeartbeatSecret()).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Implement**

`apps/web/lib/security/pairingCode.ts`:

```ts
import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'; // omits 0/O/1/I/L

export function generatePairingCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `AUDIENCE-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function generateHeartbeatSecret(): string {
  return randomBytes(32).toString('hex');
}
```

- [ ] **Step 3: generatePairingCode action**

`apps/web/server-actions/generatePairingCode.ts`:

```ts
'use server';

import { requireUser } from '@/lib/auth/requireUser';
import { generatePairingCode, generateHeartbeatSecret } from '@/lib/security/pairingCode';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result = { ok: true; code: string; expiresAt: string } | { ok: false; error: string };

export async function generatePairingCodeForEvent(eventId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const code = generatePairingCode();
  const heartbeatSecret = generateHeartbeatSecret();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await supabase.from('pairing_codes').insert({
    code,
    event_id: eventId,
    heartbeat_secret: heartbeatSecret,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, code, expiresAt };
}
```

- [ ] **Step 4: Run tests, commit**

```bash
cd apps/web && pnpm test --run lib/security && cd ../..
git add apps/web
git commit -m "feat(pairing): add pairing code generator and server action"
```

---

### Task 32: API routes /api/pair/redeem and /api/pair/heartbeat

**Files:**
- Create: `apps/web/app/api/pair/redeem/route.ts`
- Create: `apps/web/app/api/pair/heartbeat/route.ts`

- [ ] **Step 1: Redeem endpoint (thin RPC wrapper)**

```ts
import { z } from 'zod';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

const bodySchema = z.object({
  code: z.string().regex(/^AUDIENCE-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  tunnel_url: z.string().url(),
  source_id: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc('redeem_pairing_code', {
      p_code: parsed.data.code,
      p_tunnel_url: parsed.data.tunnel_url,
      p_source_id: parsed.data.source_id,
    })
    .single();

  if (error) {
    const msg = error.message;
    if (msg.includes('code_not_found')) return Response.json({ error: 'code_not_found' }, { status: 404 });
    if (msg.includes('code_consumed')) return Response.json({ error: 'code_consumed' }, { status: 410 });
    if (msg.includes('code_expired')) return Response.json({ error: 'code_expired' }, { status: 410 });
    return Response.json({ error: 'redeem_failed' }, { status: 500 });
  }

  return Response.json({
    event_id: data!.event_id,
    event_name: data!.event_name,
    heartbeat_secret: data!.heartbeat_secret,
  });
}
```

- [ ] **Step 2: Heartbeat endpoint (thin RPC wrapper)**

```ts
import { z } from 'zod';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

const bodySchema = z.object({
  event_id: z.string().uuid(),
  secret: z.string().length(64),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  const { data: ok, error } = await supabase.rpc('record_heartbeat', {
    p_event_id: parsed.data.event_id,
    p_secret: parsed.data.secret,
  });

  if (error || !ok) return Response.json({ error: 'forbidden' }, { status: 403 });
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(pairing): add /api/pair/redeem and /api/pair/heartbeat routes"
```

---

### Task 33: PairingCodeDisplay component + settings page

**Files:**
- Create: `apps/web/components/audience/PairingCodeDisplay.tsx`
- Create: `apps/web/app/admin/events/[slug]/settings/page.tsx`

- [ ] **Step 1: Component**

`apps/web/components/audience/PairingCodeDisplay.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { generatePairingCodeForEvent } from '@/server-actions/generatePairingCode';

type Props = {
  eventId: string;
  alreadyPaired: boolean;
  lastHeartbeat: string | null;
};

export function PairingCodeDisplay({ eventId, alreadyPaired, lastHeartbeat }: Props) {
  const [pending, start] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOnline =
    alreadyPaired && lastHeartbeat && Date.now() - new Date(lastHeartbeat).getTime() < 90_000;

  return (
    <Card>
      <h2 className="text-xl font-display mb-3">Conexão H2R Graphics</h2>
      {alreadyPaired ? (
        <p className={`mb-4 text-sm ${isOnline ? 'text-success' : 'text-danger'}`}>
          {isOnline ? '✓ Bridge online' : '⚠ Bridge offline (sem heartbeat há mais de 90s)'}
        </p>
      ) : (
        <p className="mb-4 text-sm text-ink/60">Ainda não há bridge conectada para este evento.</p>
      )}

      {code ? (
        <div className="bg-surface p-4 rounded-md">
          <p className="text-xs text-ink/60 mb-1">Código de pareamento (válido 15 min):</p>
          <p className="font-mono text-2xl text-primary">{code}</p>
          <p className="mt-3 text-xs text-ink/70">Na máquina do H2R, rode no terminal:</p>
          <code className="block mt-1 p-2 bg-ink/5 rounded text-sm">
            npx @ucob/h2r-bridge pair {code}
          </code>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}

      <Button
        className="mt-4"
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await generatePairingCodeForEvent(eventId);
            if (r.ok) setCode(r.code);
            else setError(r.error);
          })
        }
      >
        {alreadyPaired ? 'Re-parear' : 'Gerar código de pareamento'}
      </Button>
    </Card>
  );
}
```

- [ ] **Step 2: Settings page**

`apps/web/app/admin/events/[slug]/settings/page.tsx`:

```tsx
import { notFound } from 'next/navigation';

import { PairingCodeDisplay } from '@/components/audience/PairingCodeDisplay';
import { AdminShell } from '@/components/audience/AdminShell';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function EventSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, name, slug, h2r_paired_at, h2r_last_heartbeat')
    .eq('slug', slug)
    .single();
  if (!event) notFound();

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <h1 className="text-2xl font-display mb-2">Configurações — {event.name}</h1>
      <p className="text-ink/60 mb-6">URL pública: /e/{event.slug}</p>
      <PairingCodeDisplay
        eventId={event.id}
        alreadyPaired={Boolean(event.h2r_paired_at)}
        lastHeartbeat={event.h2r_last_heartbeat}
      />
    </AdminShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(pairing): add settings page with pairing code UI"
```

---

## Phase 8: Moderation Queue (Realtime)

Goal: operator approves/rejects pending submissions; approval triggers H2R fetch; UI updates live without refresh.

### Task 34: H2R payload builder

**Files:**
- Create: `apps/web/lib/h2r/buildPayload.ts`
- Create: `apps/web/lib/h2r/__tests__/buildPayload.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';

import { buildH2RPayload } from '../buildPayload';

describe('buildH2RPayload', () => {
  it('produces messages array with required shape', () => {
    const payload = buildH2RPayload({
      submissionId: '11111111-1111-1111-1111-111111111111',
      eventName: 'Evento X',
      name: 'João',
      comment: 'Olá!',
      timestampMs: 1_700_000_000_000,
    });
    expect(payload).toEqual({
      messages: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          timestamp: 1_700_000_000,
          snippet: { displayMessage: 'Olá!' },
          authorDetails: { displayName: 'João', profileImageUrl: '' },
          platform: { name: 'Evento X', logoUrl: '' },
        },
      ],
    });
  });
});
```

- [ ] **Step 2: Implement**

```ts
import type { H2RPayload } from '@audience/shared-types';

type Args = {
  submissionId: string;
  eventName: string;
  name: string;
  comment: string;
  timestampMs: number;
};

export function buildH2RPayload(args: Args): H2RPayload {
  return {
    messages: [
      {
        id: args.submissionId,
        timestamp: Math.floor(args.timestampMs / 1000),
        snippet: { displayMessage: args.comment },
        authorDetails: { displayName: args.name, profileImageUrl: '' },
        platform: { name: args.eventName, logoUrl: '' },
      },
    ],
  };
}
```

- [ ] **Step 3: Run tests, commit**

```bash
cd apps/web && pnpm test --run lib/h2r && cd ../..
git add apps/web
git commit -m "feat(h2r): add payload builder for HTTP listener format"
```

---

### Task 35: approve/reject server actions

**Files:**
- Create: `apps/web/server-actions/moderation.ts`

- [ ] **Step 1: Implement (thin wrapper around RPCs — only the H2R fetch lives in Node)**

```ts
'use server';

import { revalidatePath } from 'next/cache';

import { buildH2RPayload } from '@/lib/h2r/buildPayload';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

export async function approveSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();

  // RPC atomically transitions pending → approved and returns the data we need
  const { data, error } = await supabase
    .rpc('claim_submission_for_send', { p_submission_id: submissionId })
    .single();

  if (error) return { ok: false, error: 'Falha ao aprovar.' };
  if (!data) return { ok: true }; // idempotent: not pending or not owned

  if (!data.webhook_url) {
    await supabase.rpc('mark_submission_failed', {
      p_submission_id: submissionId,
      p_error: 'h2r_not_configured',
    });
    revalidatePath(`/admin/events/${data.event_slug}`);
    return { ok: false, error: 'H2R não está conectado para este evento.' };
  }

  const payload = buildH2RPayload({
    submissionId: data.submission_id,
    eventName: data.event_name,
    name: data.display_name,
    comment: data.comment,
    timestampMs: Date.now(),
  });

  try {
    const res = await fetch(data.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    await supabase.rpc('mark_submission_failed', {
      p_submission_id: submissionId,
      p_error: err instanceof Error ? err.message : String(err),
    });
    revalidatePath(`/admin/events/${data.event_slug}`);
    return { ok: false, error: 'Falha ao enviar pra H2R. Tente novamente.' };
  }

  await supabase.rpc('mark_submission_sent', { p_submission_id: submissionId });
  revalidatePath(`/admin/events/${data.event_slug}`);
  return { ok: true };
}

export async function rejectSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('reject_submission', { p_submission_id: submissionId });
  if (error) return { ok: false, error: 'Falha ao rejeitar.' };
  return { ok: true };
}

export async function retrySubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('reset_submission_for_retry', {
    p_submission_id: submissionId,
  });
  if (error) return { ok: false, error: 'Falha ao reiniciar.' };
  return approveSubmission(submissionId);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web
git commit -m "feat(moderation): add approve/reject/retry actions with H2R fetch"
```

---

### Task 36: SubmissionCard + ModerationQueue

**Files:**
- Create: `apps/web/components/audience/SubmissionCard.tsx`
- Create: `apps/web/components/audience/ModerationQueue.tsx`
- Create: `apps/web/app/admin/events/[slug]/page.tsx`

- [ ] **Step 1: SubmissionCard**

```tsx
'use client';

import { useTransition } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { approveSubmission, rejectSubmission, retrySubmission } from '@/server-actions/moderation';
import type { SubmissionStatus } from '@audience/shared-types';

type Props = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  createdAt: string;
  errorMessage: string | null;
};

export function SubmissionCard({ id, name, comment, status, createdAt, errorMessage }: Props) {
  const [pending, start] = useTransition();
  const isFinal = status === 'sent' || status === 'rejected';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-ink truncate">{name}</span>
            <Badge status={status} />
          </div>
          <p className="text-ink/80 break-words">{comment}</p>
          <p className="mt-2 text-xs text-ink/40">
            {new Date(createdAt).toLocaleTimeString('pt-BR')}
          </p>
          {errorMessage ? <p className="mt-1 text-xs text-danger">Erro: {errorMessage}</p> : null}
        </div>
      </div>
      {!isFinal ? (
        <div className="mt-4 flex gap-2">
          {status === 'pending' ? (
            <>
              <Button
                variant="accent"
                loading={pending}
                onClick={() => start(() => approveSubmission(id))}
              >
                Aprovar
              </Button>
              <Button
                variant="ghost"
                loading={pending}
                onClick={() => start(() => rejectSubmission(id))}
              >
                Rejeitar
              </Button>
            </>
          ) : null}
          {status === 'failed' ? (
            <Button loading={pending} onClick={() => start(() => retrySubmission(id))}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 2: ModerationQueue with Realtime**

`apps/web/components/audience/ModerationQueue.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

import { SubmissionCard } from './SubmissionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { SubmissionStatus } from '@audience/shared-types';

type Item = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  created_at: string;
  error_message: string | null;
};

type Props = { eventId: string; initial: Item[] };

export function ModerationQueue({ eventId, initial }: Props) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`event:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions', filter: `event_id=eq.${eventId}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === 'INSERT') return [payload.new as Item, ...prev];
            if (payload.eventType === 'UPDATE')
              return prev.map((i) => (i.id === (payload.new as Item).id ? (payload.new as Item) : i));
            if (payload.eventType === 'DELETE')
              return prev.filter((i) => i.id !== (payload.old as { id: string }).id);
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (items.length === 0) {
    return <EmptyState title="Sem submissões ainda" description="Quando o público enviar, aparece aqui em tempo real." />;
  }

  return (
    <div className="grid gap-3">
      {items.map((i) => (
        <SubmissionCard
          key={i.id}
          id={i.id}
          name={i.name}
          comment={i.comment}
          status={i.status}
          createdAt={i.created_at}
          errorMessage={i.error_message}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Event moderation page**

`apps/web/app/admin/events/[slug]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/audience/AdminShell';
import { ModerationQueue } from '@/components/audience/ModerationQueue';
import { Button } from '@/components/ui/Button';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function EventModerationPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, name, slug, h2r_paired_at, h2r_last_heartbeat')
    .eq('slug', slug)
    .single();
  if (!event) notFound();

  const { data: subs } = await supabase
    .from('submissions')
    .select('id, name, comment, status, created_at, error_message')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display">{event.name}</h1>
          <p className="text-sm text-ink/60">audience.app/e/{event.slug}</p>
        </div>
        <Link href={`/admin/events/${slug}/settings`}>
          <Button variant="ghost">Configurações</Button>
        </Link>
      </div>
      <ModerationQueue eventId={event.id} initial={subs ?? []} />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Manual smoke test**

In two browser windows: `/e/<slug>` (incognito) and `/admin/events/<slug>` (logged in). Submit from incognito → see card appear in admin queue with no refresh. Click Approve → status updates live → check H2R receiving (mock or real).

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(moderation): add realtime queue with SubmissionCard and approve flow"
```

---

## Phase 9: Bridge CLI (`@ucob/h2r-bridge`)

Goal: standalone Node CLI that handles cloudflared download/spawn, parses tunnel URL, redeems pairing code, and runs heartbeat loop.

### Task 37: Package skeleton

**Files:**
- Create: `packages/h2r-bridge/package.json`
- Create: `packages/h2r-bridge/tsconfig.json`
- Create: `packages/h2r-bridge/src/index.ts`
- Create: `packages/h2r-bridge/tsup.config.ts`

- [ ] **Step 1: Create dirs**

```bash
mkdir -p packages/h2r-bridge/src/commands packages/h2r-bridge/tests
```

`packages/h2r-bridge/package.json`:

```json
{
  "name": "@ucob/h2r-bridge",
  "version": "0.1.0",
  "description": "Bridges H2R Graphics on the local machine to the Audience moderation platform.",
  "license": "MIT",
  "type": "module",
  "bin": { "ucob-h2r-bridge": "./dist/index.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "lint": "echo skip",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "prompts": "^2.4.2",
    "kleur": "^4.1.5",
    "@audience/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "@types/prompts": "^2.4.9",
    "tsup": "^8.3.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "typescript": "^5.6.0"
  }
}
```

`packages/h2r-bridge/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "module": "NodeNext", "moduleResolution": "NodeNext" },
  "include": ["src/**/*"]
}
```

`packages/h2r-bridge/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
});
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Commit**

```bash
git add packages/h2r-bridge pnpm-lock.yaml
git commit -m "chore(bridge): scaffold @ucob/h2r-bridge package"
```

---

### Task 38: cloudflared wrapper (download + spawn + parse)

**Files:**
- Create: `packages/h2r-bridge/src/cloudflared.ts`
- Create: `packages/h2r-bridge/tests/cloudflared.test.ts`

- [ ] **Step 1: Test parser**

```ts
import { describe, it, expect } from 'vitest';

import { parseTunnelUrl } from '../src/cloudflared';

describe('parseTunnelUrl', () => {
  it('extracts trycloudflare URL from log line', () => {
    const line = '2026-04-29T12:34:56Z INF +-------------------------+ Your quick Tunnel has been created! Visit it at: |  https://abc-xyz-123.trycloudflare.com  |';
    expect(parseTunnelUrl(line)).toBe('https://abc-xyz-123.trycloudflare.com');
  });

  it('returns null when no URL present', () => {
    expect(parseTunnelUrl('regular log line')).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

`packages/h2r-bridge/src/cloudflared.ts`:

```ts
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { homedir, platform, arch } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

export function parseTunnelUrl(line: string): string | null {
  const m = line.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i);
  return m?.[1] ?? null;
}

const BRIDGE_DIR = join(homedir(), '.ucob-h2r-bridge');

function binaryName(): string {
  const p = platform();
  const a = arch();
  if (p === 'darwin') return a === 'arm64' ? 'cloudflared-darwin-arm64' : 'cloudflared-darwin-amd64';
  if (p === 'linux') return a === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
  if (p === 'win32') return 'cloudflared-windows-amd64.exe';
  throw new Error(`platform_unsupported: ${p}/${a}`);
}

const DOWNLOAD_BASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download';

export async function ensureCloudflared(): Promise<string> {
  if (!existsSync(BRIDGE_DIR)) mkdirSync(BRIDGE_DIR, { recursive: true });
  const name = binaryName();
  const dest = join(BRIDGE_DIR, name);
  if (existsSync(dest)) return dest;
  const res = await fetch(`${DOWNLOAD_BASE}/${name}`);
  if (!res.ok || !res.body) throw new Error(`download_failed: ${res.status}`);
  await pipeline(res.body, createWriteStream(dest, { mode: 0o755 }));
  return dest;
}

export type TunnelHandle = { url: string; process: ChildProcess };

export function startTunnel(binPath: string, port: number): Promise<TunnelHandle> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, ['tunnel', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const url = parseTunnelUrl(text);
      if (url) {
        proc.stderr?.off('data', onData);
        proc.stdout?.off('data', onData);
        resolve({ url, process: proc });
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code !== 0) reject(new Error(`cloudflared_exit_${code}`));
    });
    setTimeout(() => reject(new Error('cloudflared_timeout')), 30_000);
  });
}
```

- [ ] **Step 3: Run tests, commit**

```bash
cd packages/h2r-bridge && pnpm test && cd ../..
git add packages/h2r-bridge
git commit -m "feat(bridge): cloudflared download, spawn, and tunnel URL parsing"
```

---

### Task 39: API client + state persistence

**Files:**
- Create: `packages/h2r-bridge/src/api.ts`
- Create: `packages/h2r-bridge/src/state.ts`

- [ ] **Step 1: API client**

```ts
const API = process.env.AUDIENCE_API_URL ?? 'https://audience.app';

export async function redeemPairing(
  code: string,
  tunnelUrl: string,
  sourceId: string,
): Promise<{ event_id: string; event_name: string; heartbeat_secret: string }> {
  const res = await fetch(`${API}/api/pair/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, tunnel_url: tunnelUrl, source_id: sourceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `redeem_failed_${res.status}`);
  }
  return res.json() as Promise<{ event_id: string; event_name: string; heartbeat_secret: string }>;
}

export async function sendHeartbeat(eventId: string, secret: string): Promise<void> {
  await fetch(`${API}/api/pair/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId, secret }),
  });
}
```

- [ ] **Step 2: State persistence**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR = join(homedir(), '.ucob-h2r-bridge');
const FILE = join(DIR, 'state.json');

export type BridgeState = {
  event_id: string;
  event_name: string;
  source_id: string;
  heartbeat_secret: string;
};

export function saveState(state: BridgeState): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function loadState(): BridgeState | null {
  if (!existsSync(FILE)) return null;
  return JSON.parse(readFileSync(FILE, 'utf8')) as BridgeState;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/h2r-bridge
git commit -m "feat(bridge): add API client and state persistence"
```

---

### Task 40: pair command + entry point

**Files:**
- Create: `packages/h2r-bridge/src/commands/pair.ts`
- Create: `packages/h2r-bridge/src/index.ts`

- [ ] **Step 1: pair command**

```ts
import kleur from 'kleur';
import prompts from 'prompts';

import { ensureCloudflared, startTunnel } from '../cloudflared.js';
import { redeemPairing, sendHeartbeat } from '../api.js';
import { saveState } from '../state.js';

const H2R_PORT = 4001;

export async function pair(code: string): Promise<void> {
  if (!/^AUDIENCE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    console.error(kleur.red('✗ Código inválido. Esperado AUDIENCE-XXXX-XXXX.'));
    process.exit(1);
  }

  console.log(kleur.cyan('? Verificando H2R Graphics local...'));
  try {
    const probe = await fetch(`http://localhost:${H2R_PORT}/`).catch(() => null);
    if (!probe) console.warn(kleur.yellow('⚠  H2R não respondeu — verifique se está aberto.'));
  } catch { /* ignore */ }

  const { sourceId } = await prompts({
    type: 'text',
    name: 'sourceId',
    message: 'Source-id do HTTP Listener (encontra no H2R em Data Sources):',
    validate: (v: string) => v.length >= 4 || 'mínimo 4 caracteres',
  });
  if (!sourceId) process.exit(1);

  console.log(kleur.cyan('↓ Garantindo cloudflared...'));
  const bin = await ensureCloudflared();

  console.log(kleur.cyan('↗ Iniciando tunnel...'));
  const tunnel = await startTunnel(bin, H2R_PORT);
  console.log(kleur.green(`✓ Tunnel ativo: ${tunnel.url}`));

  console.log(kleur.cyan('↗ Validando código de pareamento...'));
  const result = await redeemPairing(code, tunnel.url, sourceId);
  saveState({
    event_id: result.event_id,
    event_name: result.event_name,
    source_id: sourceId,
    heartbeat_secret: result.heartbeat_secret,
  });
  console.log(kleur.green(`✓ Conectado ao evento "${result.event_name}"`));
  console.log(kleur.dim('Pressione Ctrl+C para encerrar. Mantenha este terminal aberto durante o evento.'));

  const heartbeatTimer = setInterval(() => {
    void sendHeartbeat(result.event_id, result.heartbeat_secret);
  }, 30_000);
  void sendHeartbeat(result.event_id, result.heartbeat_secret);

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    tunnel.process.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
```

- [ ] **Step 2: Entry point**

`packages/h2r-bridge/src/index.ts`:

```ts
import { Command } from 'commander';

import { pair } from './commands/pair.js';

const program = new Command();
program
  .name('ucob-h2r-bridge')
  .description('Bridge H2R Graphics ↔ Audience platform')
  .version('0.1.0');

program
  .command('pair <code>')
  .description('Pair this machine with an Audience event using a pairing code')
  .action(async (code: string) => {
    try {
      await pair(code);
    } catch (err) {
      console.error('Erro:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
```

- [ ] **Step 3: Build and smoke test**

```bash
cd packages/h2r-bridge && pnpm build && cd ../..
```

Smoke test (replace `AUDIENCE-XXXX-XXXX` with a real code from your dev panel):

```bash
node packages/h2r-bridge/dist/index.js pair AUDIENCE-XXXX-XXXX
```

- [ ] **Step 4: Commit**

```bash
git add packages/h2r-bridge
git commit -m "feat(bridge): implement pair command with cloudflared and heartbeat"
```

---

## Phase 10: Observability + E2E + Docs

Goal: Sentry integrated; happy-path E2E test green; runbook written; deployment docs in README.

### Task 41: Sentry integration (web)

**Files:**
- Create: `apps/web/instrumentation.ts`
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`

- [ ] **Step 1: Install**

```bash
cd apps/web && pnpm add @sentry/nextjs@^8.30.0 && cd ../..
```

- [ ] **Step 2: Add configs (use Sentry wizard if you have org/DSN)**

`apps/web/sentry.client.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
```

`apps/web/sentry.server.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
});
```

`apps/web/instrumentation.ts`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(observability): integrate Sentry on web app"
```

---

### Task 42: Playwright E2E happy path

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/submit-and-approve.spec.ts`

- [ ] **Step 1: Install**

```bash
cd apps/web && pnpm add -D @playwright/test@^1.48.0 && pnpm exec playwright install --with-deps chromium && cd ../..
```

- [ ] **Step 2: Config**

`apps/web/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Test (assumes seeded event `teste-2026`)**

`apps/web/tests/e2e/submit-and-approve.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('public submission appears on admin queue', async ({ page, browser }) => {
  await page.goto('/e/teste-2026');
  await page.getByLabel('Seu nome').fill('Tester E2E');
  await page.getByLabel('Sua mensagem').fill('Olá teste');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Recebido!')).toBeVisible();
});
```

- [ ] **Step 4: Add E2E to CI**

In `.github/workflows/ci.yml` add a job (after build):

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
        working-directory: apps/web
      - run: pnpm exec playwright test
        working-directory: apps/web
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "test(e2e): add Playwright happy path test for submission flow"
```

---

### Task 43: Runbook for live event incidents

**Files:**
- Create: `docs/runbooks/incidente-evento-ao-vivo.md`

- [ ] **Step 1: Write runbook**

```markdown
# Runbook — Incidente durante evento ao vivo

## Sintoma 1: Painel mostra "Bridge offline"

**Causa provável:** terminal CLI fechado ou rede caiu na máquina H2R.

**Mitigação:**
1. Volte na máquina H2R
2. Verifique terminal — se fechado: `npx @ucob/h2r-bridge resume`
3. Se rede caiu: aguarde reconexão e o heartbeat retoma sozinho

## Sintoma 2: Comentário aprovado fica "failed"

**Causa provável:** H2R fechou ou source-id mudou.

**Mitigação:**
1. Verifique se H2R Graphics está aberto
2. Em Data Sources, confirme que o HTTP Listener ainda existe e source-id é o mesmo
3. Se mudou: encerre bridge (Ctrl+C) e re-pareie com `npx @ucob/h2r-bridge pair <novo-code>`
4. Use botão "Tentar novamente" no card

## Sintoma 3: Vercel offline

**Causa:** Vercel SLA caiu (raro).

**Mitigação:**
1. Verifique <https://www.vercel-status.com/>
2. Submissões públicas falham até voltar
3. Se persistir > 30 min e o evento está no ar: comunique via meios alternativos (interrompa coleta)

## Sintoma 4: Flood de spam

**Sinal:** painel recebe > 100 submissões/min.

**Mitigação:**
1. No painel, vá em Configurações do evento
2. Clique em "Pausar submissões" (`submissions_open = false`)
3. URL pública passa a mostrar mensagem "Submissões encerradas"
4. Releia rate limit no DB se necessário (`select count(*) from submissions where created_at > now() - interval '1 minute'`)

## Sintoma 5: Pairing code expirou antes de usar

**Mitigação:** organizador clica "Re-parear" no painel — gera novo código, descarta o antigo.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks
git commit -m "docs(runbook): add incident response runbook for live events"
```

---

### Task 44: Production deployment checklist

**Files:**
- Modify: `README.md` — append Production section

- [ ] **Step 1: Append to README.md**

```markdown

## Production deployment

### Web app (Vercel)
1. Import repo in Vercel, set root to `apps/web`
2. Set env vars from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` (production project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (encrypted)
   - `IP_HASH_SALT` (32+ random chars)
   - `NEXT_PUBLIC_SITE_URL` (your domain)
   - `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
   - `RESEND_API_KEY` (or use Supabase default email if testing)
3. Deploy

### Supabase production
1. Create project at <https://supabase.com>
2. Run migrations: `supabase link --project-ref <ref> && supabase db push`
3. Run seed: `supabase db remote commit` (or paste seed.sql in SQL editor)
4. Auth → Settings → enable email magic link, disable email signup
5. Auth → URL config → set Redirect URLs to `https://<domain>/auth/callback`
6. SMTP: configure Resend (or use Supabase default for low volume)

### Bridge CLI npm publish
1. `cd packages/h2r-bridge`
2. `pnpm build`
3. `npm login` (need account with publish access to `@ucob` org)
4. `npm publish --access public`
5. Verify with `npx @ucob/h2r-bridge --version` from a clean shell

### Pre-event checklist
- [ ] Test full flow on staging (one event end-to-end including bridge CLI)
- [ ] Verify Sentry receives a test error
- [ ] Confirm Supabase backup enabled (Settings → Database → Backups)
- [ ] Print QR code with public URL, place at venue
- [ ] Brief operator on runbook (`docs/runbooks/incidente-evento-ao-vivo.md`)
- [ ] Confirm cloudflared works on H2R machine (firewall, antivirus)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add production deployment checklist"
```

---

## Phase 11 — Invite + Password Auth (added 2026-04-29)

**Goal:** Replace open magic-link signup with invite-only password auth. Admin invites by email; invited user sets password; logs in with email+password.

### Tasks
- **Task 45:** Migration `00100000_invitations.sql` — `invitations` table (id, email, token, invited_by, expires_at, accepted_at) + RLS (only admins read; service role insert/update).
- **Task 46:** Server action `inviteUser(email)` — uses Supabase admin API `inviteUserByEmail`. Stores invite record. Returns ok/error.
- **Task 47:** `/admin/users` page — list users + invite form. Owner-only.
- **Task 48:** `/auth/accept-invite/[token]` page — set password form. Calls `supabase.auth.updateUser({ password })`.
- **Task 49:** Update `/admin` login — email + password fields (primary). Keep "Receber link mágico" as secondary option.
- **Task 50:** Disable public signup in Supabase Dashboard (manual step in runbook).
- **Task 51:** Branded invite email template `supabase/templates/invite.html`.

### Schema
```sql
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.invitations enable row level security;
create policy "invitations_owner_select" on public.invitations for select using (auth.uid() = invited_by);
```

## Phase 12 — Event admin tabs (added 2026-04-29)

**Goal:** Inside `/admin/events/[slug]`, organize features into tabs instead of one long page.

### Tasks
- **Task 52:** Tabs component `components/ui/Tabs.tsx` — accessible, keyboard-navigable.
- **Task 53:** Restructure `/admin/events/[slug]/page.tsx` with 4 tabs:
  - **Moderação** (default) — fila realtime + counters
  - **Conexão H2R** — pairing code + status (moves PairingCodeDisplay here)
  - **Compartilhar** — ShareCard + QR + stats de submissões + link `/admin/users` para convidar moderadores
  - **Configurações** — pause/reopen submissions, rename event, danger zone (delete)
- **Task 54:** Move existing `/settings` content into the "Configurações" tab — keep route as alias/redirect.

## Phase 13 — Public page redesign (added 2026-04-29)

**Goal:** `/e/[slug]` becomes a beautiful, mobile-first experience for the audience.

### Tasks
- **Task 55:** Redesign `/e/[slug]` page:
  - Full-bleed gradient background using event theme tokens
  - Animated hero (subtle parallax / fade-in)
  - Large touch-friendly inputs (h-14 minimum on mobile)
  - Floating-label inputs with character counter inline
  - Submit button = full-width, bold, accent color
  - "Recebido" success state with celebratory animation (confetti or checkmark animation)
  - Footer with brand line ("Powered by UCOB" or event-customizable)
- **Task 56:** Mobile responsiveness pass — all touch targets ≥44px, readable at 375px width, no horizontal scroll, large fonts (18px body min on mobile).
- **Task 57:** Lighthouse pass — Performance ≥ 90, Accessibility ≥ 95 on mobile.

## Self-review summary

**Spec coverage check:** every section of the spec has at least one task implementing it:
- §3 Stack → Tasks 1–8 (foundation + scaffolding)
- §4 Architecture → Tasks 18 (clients), 32 (api routes), 36 (queue), 40 (CLI)
- §5 Schema → Tasks 10–14 (tables) + 14b/14c (RPCs)
- §6 Routes → Tasks 26 (public form), 27 (auth), 30 (events list/new), 33 (settings), 36 (moderation)
- §7 Theming → Tasks 7, 17, 26 (loadTheme + ThemeProvider + page integration)
- §8 Components → Tasks 19–22 (UI primitives + ui-kit page)
- §9 Bridge CLI → Tasks 37–40
- §10 Approval flow → Tasks 14b (state machine RPCs) + 35 (thin server action with H2R fetch)
- §11 Security → Tasks 13 (rate limit RPC), 24 (sanitize), 31 (pairing entropy), 14c (atomic redeem RPC), 32 (RPC-validated heartbeat)
- §12 Observability → Task 41
- §13 Tests → Task 42 (E2E) plus inline TDD per task
- §14 Multi-event → covered via slug-based routing + RLS in tasks 11, 12
- §16–18 Pre-reqs/cronograma/open-questions → reference, no implementation
- §19 User guide → README appended in Task 44
- §20 Superpowers workflow → meta, applied throughout
- §21 Disaster recovery → Task 43

**RPC-first design:** business logic lives in Postgres functions (Tasks 13, 14b, 14c) so server actions and API routes are thin proxies. State transitions are atomic via SECURITY DEFINER functions that enforce ownership/validation server-side. Only the outbound HTTP call to H2R Graphics stays in Node (Postgres can't reliably do outbound HTTPS without `pg_net`).

| Operation | Where logic lives |
|---|---|
| Submit comment (public) | RPC `submit_comment` (Task 13) |
| Approve | RPC `claim_submission_for_send` + `mark_submission_sent`/`mark_submission_failed` (Task 14b); fetch in Node (Task 35) |
| Reject | RPC `reject_submission` (Task 14b) |
| Retry | RPC `reset_submission_for_retry` + approve flow (Task 14b + 35) |
| Redeem pairing | RPC `redeem_pairing_code` (Task 14c); API route is wrapper (Task 32) |
| Heartbeat | RPC `record_heartbeat` (Task 14c); API route is wrapper (Task 32) |

**Placeholder scan:** none. Every step has exact code, command, or path.

**Type consistency:** `H2RPayload`, `SubmissionStatus`, `ThemeTokens` are defined once in `packages/shared-types` and consumed everywhere. Server action return types `Result` are consistent (`{ ok: true; ... } | { ok: false; error: string }`). RPC names match between migration (Tasks 13, 14b, 14c) and call sites (Tasks 24, 32, 35).

---

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batched with checkpoints

Which approach?
