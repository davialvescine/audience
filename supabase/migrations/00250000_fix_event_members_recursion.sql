-- 00250000_fix_event_members_recursion.sql
--
-- Bug em 00220000: policy "event_members_visible_to_members" queries
-- a propria tabela event_members, criando recursao infinita. Toda
-- query em events que toca event_members (via events_visible_to_members)
-- dispara isso e quebra todo o admin (events list, INSERT, etc).
--
-- Fix: simplifica RLS de event_members. Usuario ve so as proprias linhas
-- (auth.uid() = user_id). Pra listar outros membros do mesmo evento usa
-- a RPC list_event_members (SD, ja faz check de membership).

drop policy if exists "event_members_visible_to_members" on public.event_members;

create policy "event_members_self_select" on public.event_members
  for select
  using (auth.uid() = user_id);
