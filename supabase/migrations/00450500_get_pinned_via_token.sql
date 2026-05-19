-- Versão tokenizada de get_pinned_submission. Permite moderador externo
-- saber qual submission está fixada (pra mostrar "📌 Fixada" e botão
-- Soltar). Read-only.

create or replace function public.get_pinned_via_token(p_token text)
returns table (
  id uuid,
  name text,
  comment text,
  sent_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_event_id uuid;
  v_pinned uuid;
begin
  v_event_id := public.validate_moderator_token(p_token);
  if v_event_id is null then
    return;
  end if;

  select pinned_submission_id into v_pinned
    from public.events
   where id = v_event_id;
  if v_pinned is null then
    return;
  end if;

  return query
    select s.id, s.name, s.comment, s.sent_at
      from public.submissions s
     where s.id = v_pinned;
end;
$$;

grant execute on function public.get_pinned_via_token(text) to anon, authenticated;
