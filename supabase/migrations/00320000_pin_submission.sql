-- 00320000_pin_submission.sql
--
-- Fixar uma mensagem no telao por tempo indeterminado. Uma fixada por
-- evento. Operador clica "Fixar" → fica no telao ate clicar "Soltar".

alter table public.events
  add column if not exists pinned_submission_id uuid
    references public.submissions(id) on delete set null;

-- pin_submission: marca como sent (bump display_count) e fixa no evento.
create or replace function public.pin_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select s.event_id into v_event_id
  from public.submissions s
  join public.event_members em on em.event_id = s.event_id and em.user_id = auth.uid()
  where s.id = p_submission_id;

  if v_event_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.submissions
    set status = 'sent',
        sent_at = now(),
        error_message = null,
        display_count = display_count + 1
    where id = p_submission_id;

  update public.events
    set pinned_submission_id = p_submission_id
    where id = v_event_id;
end;
$$;

grant execute on function public.pin_submission(uuid) to authenticated;

-- unpin_submission: limpa o pinned no evento.
create or replace function public.unpin_submission(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.event_members
    where event_id = p_event_id and user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.events
    set pinned_submission_id = null
    where id = p_event_id;
end;
$$;

grant execute on function public.unpin_submission(uuid) to authenticated;

-- get_pinned_submission: retorna a mensagem fixada (ou vazio) do evento
-- pelo slug. Usado pelo /telao pra polling.
create or replace function public.get_pinned_submission(p_slug text)
returns table (id uuid, name text, comment text, sent_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.name, s.comment, s.sent_at
  from public.submissions s
  join public.events e on e.id = s.event_id
  where e.slug = p_slug
    and e.pinned_submission_id = s.id
  limit 1;
$$;

revoke execute on function public.get_pinned_submission(text) from public;
grant execute on function public.get_pinned_submission(text) to anon, authenticated;
