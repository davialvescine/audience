-- Temp diagnostic. Vai ser dropado em seguida.
create or replace function public.diag_rls_state(p_user uuid)
returns table (
  policies_on_events text,
  events_visible_via_member int,
  events_owned int,
  member_rows int,
  total_events int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    string_agg(p.policyname || '(' || p.cmd || ')', ', ' order by p.policyname)::text as policies_on_events,
    (select count(*)::int from public.events e where exists (
      select 1 from public.event_members em where em.event_id = e.id and em.user_id = p_user
    )) as events_visible_via_member,
    (select count(*)::int from public.events where owner_id = p_user) as events_owned,
    (select count(*)::int from public.event_members where user_id = p_user) as member_rows,
    (select count(*)::int from public.events) as total_events
  from pg_policies p
  where p.tablename = 'events';
end;
$$;

grant execute on function public.diag_rls_state(uuid) to authenticated, service_role, anon;
