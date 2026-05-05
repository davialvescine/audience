-- 00210000_token_approve_to_sent.sql
--
-- Bug: moderate_with_token (Sprint 2.9) aprovava submissions deixando
-- status='approved'. /telao publico filtra por status='sent', entao
-- as mensagens ficavam invisiveis pra audiencia ate o dono fazer um
-- "Disparar fila" no admin.
--
-- Para eventos SEM H2R webhook (a maioria), nao ha motivo pra ter o
-- estado intermediario 'approved' — vai direto pra 'sent' e
-- aparece no /telao em segundos.
--
-- Para eventos COM H2R webhook, mantem em 'approved' (admin precisa
-- disparar pro H2R via flush manual). Token moderators nao tem
-- acesso a H2R config.

create or replace function public.moderate_with_token(
  p_token text,
  p_submission_id uuid,
  p_action text  -- 'approve' | 'reject'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_target_event uuid;
  v_has_webhook boolean;
begin
  v_event_id := public.validate_moderator_token(p_token);
  if v_event_id is null then
    raise exception 'invalid_token' using errcode = '42501';
  end if;

  select event_id into v_target_event
  from public.submissions
  where id = p_submission_id;
  if v_target_event is null or v_target_event <> v_event_id then
    raise exception 'submission_not_in_token_scope' using errcode = '42501';
  end if;

  if p_action = 'approve' then
    select (h2r_webhook_url is not null) into v_has_webhook
    from public.events
    where id = v_event_id;

    if v_has_webhook then
      update public.submissions
        set status = 'approved', approved_at = now()
        where id = p_submission_id and status = 'pending';
    else
      update public.submissions
        set status = 'sent', approved_at = now(), sent_at = now()
        where id = p_submission_id and status = 'pending';
    end if;
  elsif p_action = 'reject' then
    update public.submissions
      set status = 'rejected'
      where id = p_submission_id and status in ('pending', 'failed');
  else
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
end;
$$;
