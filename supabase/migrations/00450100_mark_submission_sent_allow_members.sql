-- mark_submission_sent só aceitava events.owner_id. Quando o evento tem
-- moderadores adicionais (event_members), eles conseguiam aprovar via
-- claim_submission_for_send (que ja aceita member) mas não conseguiam
-- finalizar com auto_send_on_approve ligado nem com o botão "Mostrar
-- no telão" — caía em 'forbidden'.
--
-- Mesmo fix do claim_submission_for_send: aceita owner OU event_member.

create or replace function public.mark_submission_sent(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id
      and (
        e.owner_id = auth.uid()
        or exists (
          select 1 from public.event_members m
            where m.event_id = e.id and m.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'sent', sent_at = now(), error_message = null
    where id = p_submission_id;
end;
$$;

grant execute on function public.mark_submission_sent(uuid) to authenticated;

-- Mesmo problema com mark_submission_failed e reset_submission_for_retry —
-- ambos checam só owner. Atualiza pra aceitar event_member também.

create or replace function public.mark_submission_failed(p_submission_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id
      and (
        e.owner_id = auth.uid()
        or exists (
          select 1 from public.event_members m
            where m.event_id = e.id and m.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'failed', error_message = p_error
    where id = p_submission_id;
end;
$$;

grant execute on function public.mark_submission_failed(uuid, text) to authenticated;
