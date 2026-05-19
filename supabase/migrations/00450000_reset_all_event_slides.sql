-- RPC pra resetar TODOS os dados de teste de um evento numa tacada:
-- - wordcloud_words de todos os slides do evento
-- - poll_votes de todos os slides do evento
-- - open_ended_responses + open_ended_votes (CASCADE deleta os votos quando
--   a response é deletada — open_ended_votes FK ON DELETE CASCADE)
--
-- NÃO mexe em:
-- - submissions (comentários moderados) — tem seu próprio fluxo de reset
--   via UI de moderação. Limpar aqui poderia apagar moderação real por
--   acidente.
-- - slides em si — só limpa os DADOS dentro deles. Slides ficam intactos.
--
-- Auth: owner do evento OU event_member.

create or replace function public.reset_all_event_slides(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_words_deleted bigint;
  v_votes_deleted bigint;
  v_responses_deleted bigint;
begin
  -- Authz: owner ou member do evento.
  if not exists (
    select 1 from public.events e
     where e.id = p_event_id and e.owner_id = auth.uid()
  ) and not exists (
    select 1 from public.event_members m
     where m.event_id = p_event_id and m.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Limpa palavras de TODOS os wordcloud slides do evento.
  with del as (
    delete from public.wordcloud_words
     where event_id = p_event_id
     returning 1
  )
  select count(*) into v_words_deleted from del;

  -- Limpa votos de todos os poll slides.
  with del as (
    delete from public.poll_votes
     where event_id = p_event_id
     returning 1
  )
  select count(*) into v_votes_deleted from del;

  -- Limpa respostas open_ended (votos vão junto via CASCADE).
  with del as (
    delete from public.open_ended_responses
     where event_id = p_event_id
     returning 1
  )
  select count(*) into v_responses_deleted from del;

  return jsonb_build_object(
    'words_deleted', v_words_deleted,
    'votes_deleted', v_votes_deleted,
    'responses_deleted', v_responses_deleted
  );
end;
$$;

grant execute on function public.reset_all_event_slides(uuid) to authenticated;
revoke execute on function public.reset_all_event_slides(uuid) from anon, public;
