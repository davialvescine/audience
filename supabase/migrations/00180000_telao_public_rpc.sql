-- 00180000_telao_public_rpc.sql
--
-- Sprint 1 item 1.1: fecha gap RLS de cross-tenant leak.
--
-- Policy 'submissions_telao_public_read' (00120000) deixava anon
-- SELECT submissions.status='sent' SEM filtro de event_id, ou seja:
-- qualquer pessoa via supabase-js anon-key + REST conseguia listar
-- TODOS os comentarios aprovados de TODOS os eventos do projeto.
--
-- Fix: substitui por security-definer RPC scoped ao slug do evento.
-- /telao chama a RPC, que retorna so os submissions do evento certo.
-- Outros eventos ficam invisiveis pro anon — RLS volta a ser owner-only.

create or replace function public.get_telao_submissions_since(
  p_slug text,
  p_since timestamptz
)
returns table (
  id uuid,
  name text,
  comment text,
  created_at timestamptz,
  sent_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.name, s.comment, s.created_at, s.sent_at
  from public.submissions s
  join public.events e on e.id = s.event_id
  where e.slug = p_slug
    and s.status = 'sent'
    and (p_since is null or s.sent_at > p_since)
  order by s.sent_at asc
  limit 50;
$$;

revoke execute on function public.get_telao_submissions_since(text, timestamptz) from public;
grant execute on function public.get_telao_submissions_since(text, timestamptz) to anon, authenticated;

-- Drop a policy aberta. /telao agora usa exclusivamente a RPC acima.
-- A policy events_owner_all (autenticado, dono) continua intacta.
drop policy if exists "submissions_telao_public_read" on public.submissions;
