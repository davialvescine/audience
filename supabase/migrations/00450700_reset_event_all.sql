-- Reset MASTER do evento — apaga TODOS os dados gerados pela audiência:
-- - submissions (comentários)
-- - wordcloud_words (palavras da nuvem)
-- - poll_votes (votos)
-- - open_ended_responses + votos (CASCADE)
--
-- NÃO mexe em: slides em si, configs, eventos. Owner-only.

create or replace function public.reset_event_all(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subs bigint;
  v_words bigint;
  v_votes bigint;
  v_responses bigint;
begin
  if not exists (
    select 1 from public.events e
     where e.id = p_event_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.events
     set pinned_submission_id = null
   where id = p_event_id;

  with del as (delete from public.submissions where event_id = p_event_id returning 1)
    select count(*) into v_subs from del;

  with del as (delete from public.wordcloud_words where event_id = p_event_id returning 1)
    select count(*) into v_words from del;

  with del as (delete from public.poll_votes where event_id = p_event_id returning 1)
    select count(*) into v_votes from del;

  with del as (delete from public.open_ended_responses where event_id = p_event_id returning 1)
    select count(*) into v_responses from del;

  return jsonb_build_object(
    'submissions_deleted', v_subs,
    'words_deleted', v_words,
    'votes_deleted', v_votes,
    'responses_deleted', v_responses
  );
end;
$$;

grant execute on function public.reset_event_all(uuid) to authenticated;
revoke execute on function public.reset_event_all(uuid) from anon, public;
