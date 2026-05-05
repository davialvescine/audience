-- 00260000_fix_event_members_owner_policy.sql
--
-- Recursao residual de 00220000: event_members_managed_by_owner usa
-- FOR ALL (inclui SELECT) e consulta events. Combinado com
-- events_visible_to_members que consulta event_members → ciclo.
--
-- Fix: separa em INSERT/UPDATE/DELETE only (sem SELECT). SELECT em
-- event_members fica governado so por event_members_self_select. Pra
-- listar outros membros, owner usa a RPC list_event_members (SD).

drop policy if exists "event_members_managed_by_owner" on public.event_members;

create policy "event_members_owner_insert" on public.event_members
  for insert
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_members.event_id and e.owner_id = auth.uid()
    )
  );

create policy "event_members_owner_update" on public.event_members
  for update
  using (
    exists (
      select 1 from public.events e
      where e.id = event_members.event_id and e.owner_id = auth.uid()
    )
  );

create policy "event_members_owner_delete" on public.event_members
  for delete
  using (
    exists (
      select 1 from public.events e
      where e.id = event_members.event_id and e.owner_id = auth.uid()
    )
  );
