-- 00200000_claim_submission_fix_ambiguous.sql
--
-- Fix urgente: 00160000 introduziu erro "column reference 'event_id'
-- is ambiguous" em runtime — o return param da function chama 'event_id'
-- e a subquery referencia submissions.event_id sem qualificar com alias.
--
-- Resultado: aprovar submissions quebrou em prod. RPC sempre retornava
-- 400 com SQLSTATE 42702.
--
-- Fix: qualifica todas as colunas com alias da tabela (s.event_id,
-- e.id, e.owner_id) na UPDATE atomica.

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
  v_claimed_id uuid;
begin
  update public.submissions s
     set status = 'approved', approved_at = now()
   where s.id = p_submission_id
     and s.status = 'pending'
     and s.event_id in (select e.id from public.events e where e.owner_id = auth.uid())
  returning s.id into v_claimed_id;

  if v_claimed_id is not null then
    return query
      select s.id, s.event_id, e.slug, e.name, s.name, s.comment, e.h2r_webhook_url
      from public.submissions s
      join public.events e on e.id = s.event_id
      where s.id = p_submission_id;
    return;
  end if;

  -- Claim falhou. Diferencia "nao existe", "nao e dono", "ja claimado".
  select e.owner_id into v_owner
  from public.submissions s
  join public.events e on e.id = s.event_id
  where s.id = p_submission_id;

  if v_owner is null then
    return;
  end if;

  if v_owner <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return;
end;
$$;
