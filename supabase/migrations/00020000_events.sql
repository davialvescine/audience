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

create policy "events_owner_all" on public.events
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

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
