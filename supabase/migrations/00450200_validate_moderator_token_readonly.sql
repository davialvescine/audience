-- validate_moderator_token fazia UPDATE em moderator_tokens.last_used_at.
-- Mas get_submissions_via_token (que é READ-ONLY pra retornar a lista)
-- chama essa função internamente. O Postgres detecta o UPDATE dentro
-- duma transação que ele abriu como read-only (porque get_submissions_via_token
-- retorna table) e dispara:
--   "cannot execute UPDATE in a read-only transaction"
--
-- Sintoma: moderador externo abre o link → tela mostra "0 pendentes" mas
-- toast de erro vermelho aparece a cada polling.
--
-- Fix:
-- 1. validate_moderator_token vira função read-only puro (sem UPDATE).
-- 2. Cria touch_moderator_token (write) chamada explicitamente apenas
--    pelo moderate_with_token (que já é write).
-- 3. get_submissions_via_token continua read-only, sem touch.
--    Last_used_at = "última vez que o moderador APROVOU/REJEITOU algo",
--    semântica mais útil que "última vez que abriu a aba".

create or replace function public.validate_moderator_token(p_token text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select event_id
    from public.moderator_tokens
   where token = p_token
     and revoked_at is null
     and expires_at > now()
   limit 1;
$$;

grant execute on function public.validate_moderator_token(text) to anon, authenticated;

create or replace function public.touch_moderator_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.moderator_tokens
     set last_used_at = now()
   where token = p_token
     and revoked_at is null
     and expires_at > now();
$$;

grant execute on function public.touch_moderator_token(text) to anon, authenticated;

-- moderate_with_token também atualiza last_used_at ao final.
create or replace function public.moderate_with_token(
  p_token text,
  p_submission_id uuid,
  p_action text
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

  -- Touch last_used_at agora que sabemos que é uma escrita real.
  update public.moderator_tokens
     set last_used_at = now()
   where token = p_token;
end;
$$;

grant execute on function public.moderate_with_token(text, uuid, text) to anon, authenticated;
