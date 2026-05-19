-- RPC pra apagar TODOS os comentários (submissions) de um evento.
-- Operação destrutiva — UI confirma duplo antes de chamar.
-- Auth: só owner. Member NÃO pode (medida de segurança).

create or replace function public.reset_event_submissions(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  if not exists (
    select 1 from public.events e
     where e.id = p_event_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Solta a pin antes (FK ON DELETE NO ACTION em alguns lugares).
  update public.events
     set pinned_submission_id = null
   where id = p_event_id;

  with del as (
    delete from public.submissions
     where event_id = p_event_id
     returning 1
  )
  select count(*) into v_deleted from del;

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

grant execute on function public.reset_event_submissions(uuid) to authenticated;
revoke execute on function public.reset_event_submissions(uuid) from anon, public;
