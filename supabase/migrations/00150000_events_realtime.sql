-- 00150000_events_realtime.sql
-- Add `events` to supabase_realtime so the /telao page reloads its
-- visual config (cardBg, fontSize, position, etc.) without a manual
-- refresh when the admin saves changes via TelaoTab autosave.
--
-- Without this, all open /telao tabs (browser source / chrome PiP /
-- desktop) keep rendering with whatever config was loaded at SSR time.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;

-- REPLICA IDENTITY FULL is required so the realtime payload includes
-- the full row (including telao_config jsonb) for the client to apply.
alter table public.events replica identity full;
