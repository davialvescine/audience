-- 00140000_realtime_publication.sql
-- Add `submissions` to the supabase_realtime publication so the /telao page
-- (browser_source / chrome_pip / desktop_app modes) and the moderation queue
-- receive postgres_changes events.
--
-- Without this, the public telão page never auto-updates when a comment is
-- approved, and the moderator UI doesn't reflect status transitions
-- (pending → approved → sent), giving the appearance that "Aprovar"
-- doesn't do anything.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;

-- REPLICA IDENTITY FULL is required so the realtime payload includes the
-- pre-update row, which Supabase Realtime uses for RLS filtering.
alter table public.submissions replica identity full;
