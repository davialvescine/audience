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
