-- 00010000_themes.sql
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tokens jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.themes enable row level security;

create policy "themes_select_public" on public.themes for select using (true);
