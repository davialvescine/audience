-- 00400000_reset_slide_words.sql
--
-- Reset palavras de um slide específico (não do evento inteiro).
-- Owner ou event_member podem chamar.

create or replace function public.reset_slide_words(p_slide_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.slides where id = p_slide_id;
  if v_event_id is null then
    raise exception 'slide_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = v_event_id and e.owner_id = auth.uid()
  ) and not exists (
    select 1 from public.event_members m
    where m.event_id = v_event_id and m.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.wordcloud_words where slide_id = p_slide_id;
end;
$$;

grant execute on function public.reset_slide_words(uuid) to authenticated;
revoke execute on function public.reset_slide_words(uuid) from anon, public;
