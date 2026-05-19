-- Expande moderate_with_token pra ter paridade com a moderação completa.
-- Antes: só 'approve' | 'reject'.
-- Agora: também 'send' | 'undo' | 'pin' | 'unpin' | 'reshow'.
--
-- Mantém o gate por token. Pin/unpin afetam events.pinned_submission_id.

create or replace function public.moderate_with_token(
  p_token text,
  p_submission_id uuid,
  p_action text  -- 'approve' | 'reject' | 'send' | 'undo' | 'pin' | 'unpin' | 'reshow'
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
  v_auto_send boolean;
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
    select (h2r_webhook_url is not null), coalesce(auto_send_on_approve, false)
      into v_has_webhook, v_auto_send
    from public.events
    where id = v_event_id;

    if v_has_webhook and not v_auto_send then
      update public.submissions
        set status = 'approved', approved_at = now()
        where id = p_submission_id and status = 'pending';
    else
      -- Sem H2R OU auto-send ligado → vai direto pro telão.
      update public.submissions
        set status = 'sent', approved_at = now(), sent_at = now()
        where id = p_submission_id and status = 'pending';
    end if;

  elsif p_action = 'reject' then
    update public.submissions
      set status = 'rejected'
      where id = p_submission_id and status in ('pending', 'failed');

  elsif p_action = 'send' then
    -- Approved → sent (mostrar no telão).
    update public.submissions
      set status = 'sent', sent_at = now(), error_message = null
      where id = p_submission_id and status = 'approved';

  elsif p_action = 'undo' then
    -- Qualquer estado moderado → pending. Permite reverter um erro.
    update public.submissions
      set status = 'pending', error_message = null, approved_at = null, sent_at = null
      where id = p_submission_id and status in ('approved', 'rejected', 'sent');

  elsif p_action = 'pin' then
    -- Fixa essa submission no evento. Só uma por evento.
    update public.events
      set pinned_submission_id = p_submission_id
      where id = v_event_id;
    -- Garante que está como sent (pra aparecer no telão).
    update public.submissions
      set status = 'sent', sent_at = coalesce(sent_at, now())
      where id = p_submission_id and status in ('pending', 'approved', 'rejected');

  elsif p_action = 'unpin' then
    update public.events
      set pinned_submission_id = null
      where id = v_event_id and pinned_submission_id = p_submission_id;

  elsif p_action = 'reshow' then
    -- Re-exibe uma mensagem já enviada: volta pra pending e aprova de novo.
    update public.submissions
      set status = 'sent', sent_at = now(), error_message = null
      where id = p_submission_id and status = 'sent';

  else
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  -- Touch last_used_at (única função write pra esse token).
  update public.moderator_tokens
     set last_used_at = now()
   where token = p_token;
end;
$$;

grant execute on function public.moderate_with_token(text, uuid, text) to anon, authenticated;
