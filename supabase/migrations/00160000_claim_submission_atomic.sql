-- 00160000_claim_submission_atomic.sql
--
-- Sprint 1 item 1.2: torna claim_submission_for_send atomico.
--
-- Bug: a versao em 00060000 fazia SELECT do owner sem FOR UPDATE, depois
-- UPDATE ... WHERE status='pending'. Em 2 chamadas concorrentes:
--   - ambas passavam o owner check
--   - so uma UPDATE de fato afetava linha (filtro status='pending')
--   - mas AMBAS retornavam a row pelo SELECT trailing (sem filtro de
--     "fui eu que fiz UPDATE?"), causando dupla entrega ao H2R.
--
-- Fix: UPDATE ... RETURNING captura quem ganhou a race. So retorna
-- dados se o claim teve sucesso. Ownership check entra na WHERE clause
-- (subquery em events) — atomico com o claim.

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
  -- Atomic claim: the WHERE clause checks ownership AND status in one
  -- shot. RETURNING tells us if we won the race.
  update public.submissions
     set status = 'approved', approved_at = now()
   where id = p_submission_id
     and status = 'pending'
     and event_id in (select id from public.events where owner_id = auth.uid())
  returning id into v_claimed_id;

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
    return; -- submission inexistente
  end if;

  if v_owner <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Dono confirmado mas claim falhou: outra chamada ja pegou (race) ou
  -- status nao era pending. Retorna empty — caller trata como no-op.
  return;
end;
$$;
