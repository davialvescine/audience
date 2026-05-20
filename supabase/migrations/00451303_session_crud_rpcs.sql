-- F5: CRUD + reset de sessões. Owner OU event_member.

-- Helper: checa se o caller é owner ou member do evento.
create or replace function public._has_event_access(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.events where id = p_event_id and owner_id = auth.uid())
    or exists (
      select 1 from public.event_members where event_id = p_event_id and user_id = auth.uid()
    );
$$;

-- ----- create_session ----------------------------------------------------
create or replace function public.create_session(p_event_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pos int;
  v_name text;
begin
  if not public._has_event_access(p_event_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null or char_length(v_name) > 100 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  select coalesce(max(position), -1) + 1 into v_pos
    from public.event_sessions where event_id = p_event_id;
  insert into public.event_sessions(event_id, name, position)
    values (p_event_id, v_name, v_pos)
    returning id into v_id;
  return v_id;
end;
$$;

-- ----- rename_session ----------------------------------------------------
create or replace function public.rename_session(p_session_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_name text;
begin
  select event_id into v_event_id from public.event_sessions where id = p_session_id;
  if v_event_id is null then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if not public._has_event_access(v_event_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null or char_length(v_name) > 100 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  update public.event_sessions set name = v_name where id = p_session_id;
end;
$$;

-- ----- archive_session ---------------------------------------------------
create or replace function public.archive_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_event_id uuid;
begin
  select event_id into v_event_id from public.event_sessions where id = p_session_id;
  if v_event_id is null then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if not public._has_event_access(v_event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.event_sessions set archived_at = coalesce(archived_at, now()) where id = p_session_id;
end;
$$;

-- ----- delete_session ----------------------------------------------------
-- CASCADE delete tudo da sessão (submissions/words/votes/responses).
-- Não pode deletar a única sessão de um evento — deve sobrar pelo menos uma.
create or replace function public.delete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_count int;
  v_active_session uuid;
  v_new_active uuid;
begin
  select event_id into v_event_id from public.event_sessions where id = p_session_id;
  if v_event_id is null then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if not public._has_event_access(v_event_id) then raise exception 'forbidden' using errcode = '42501'; end if;

  select count(*) into v_count from public.event_sessions where event_id = v_event_id;
  if v_count <= 1 then
    raise exception 'cannot_delete_last_session' using errcode = 'P0001';
  end if;

  -- Se for a sessão ativa, faz fallback pra outra sessão (a primeira disponível por position).
  select active_session_id into v_active_session from public.events where id = v_event_id;
  if v_active_session = p_session_id then
    select id into v_new_active
      from public.event_sessions
      where event_id = v_event_id and id <> p_session_id
      order by position asc
      limit 1;
    update public.events
      set active_session_id = v_new_active,
          pinned_submission_id = null
      where id = v_event_id;
  end if;

  delete from public.event_sessions where id = p_session_id;
end;
$$;

-- ----- set_active_session ------------------------------------------------
-- Limpa pinned_submission_id (pin é por-evento, não faz sentido manter
-- entre sessões diferentes).
create or replace function public.set_active_session(p_event_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._has_event_access(p_event_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.event_sessions where id = p_session_id and event_id = p_event_id) then
    raise exception 'session_not_in_event' using errcode = 'P0001';
  end if;
  update public.events
    set active_session_id = p_session_id,
        pinned_submission_id = null
    where id = p_event_id;
end;
$$;

-- ----- reset_session -----------------------------------------------------
-- DELETE em todas as 4 tabelas filtrando por session_id. Retorna contagem
-- por tipo (compatível com o alert de breakdown do botão "Zerar tudo").
create or replace function public.reset_session(p_session_id uuid)
returns table (
  submissions_deleted int,
  words_deleted int,
  votes_deleted int,
  responses_deleted int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_sub int := 0;
  v_word int := 0;
  v_vote int := 0;
  v_resp int := 0;
begin
  select event_id into v_event_id from public.event_sessions where id = p_session_id;
  if v_event_id is null then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if not public._has_event_access(v_event_id) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- Solta o pin se aponta pra alguma submission dessa sessão.
  update public.events
    set pinned_submission_id = null
    where id = v_event_id
      and pinned_submission_id in (select id from public.submissions where session_id = p_session_id);

  delete from public.submissions where session_id = p_session_id;
  get diagnostics v_sub = row_count;

  delete from public.wordcloud_words where session_id = p_session_id;
  get diagnostics v_word = row_count;

  delete from public.poll_votes where session_id = p_session_id;
  get diagnostics v_vote = row_count;

  delete from public.open_ended_responses where session_id = p_session_id;
  get diagnostics v_resp = row_count;

  return query select v_sub, v_word, v_vote, v_resp;
end;
$$;

-- ----- list_sessions -----------------------------------------------------
-- Lista sessões do evento com contagem por tipo (pra UI mostrar "X comentários, Y palavras…").
create or replace function public.list_sessions(p_event_id uuid)
returns table (
  id uuid,
  name text,
  sort_order int,
  archived_at timestamptz,
  created_at timestamptz,
  is_active boolean,
  submissions_count bigint,
  words_count bigint,
  votes_count bigint,
  responses_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.position as sort_order,
    s.archived_at,
    s.created_at,
    (e.active_session_id = s.id) as is_active,
    (select count(*) from public.submissions where session_id = s.id)::bigint,
    (select count(*) from public.wordcloud_words where session_id = s.id)::bigint,
    (select count(*) from public.poll_votes where session_id = s.id)::bigint,
    (select count(*) from public.open_ended_responses where session_id = s.id)::bigint
  from public.event_sessions s
  join public.events e on e.id = s.event_id
  where s.event_id = p_event_id
    and public._has_event_access(p_event_id)
  order by s.position asc;
$$;

grant execute on function public.create_session(uuid, text) to authenticated;
grant execute on function public.rename_session(uuid, text) to authenticated;
grant execute on function public.archive_session(uuid) to authenticated;
grant execute on function public.delete_session(uuid) to authenticated;
grant execute on function public.set_active_session(uuid, uuid) to authenticated;
grant execute on function public.reset_session(uuid) to authenticated;
grant execute on function public.list_sessions(uuid) to authenticated;
