-- 00410000_open_ended.sql
--
-- Tipo de slide "open_ended" (Aberto): audiência envia resposta curta,
-- aparece como card no telão. Suporta voto opcional e nome do autor.
--
-- Estrutura:
-- - open_ended_responses: 1 row por resposta enviada.
-- - open_ended_votes: 1 row por voto (par response_id + voter_fp).
-- - vote_count denormalizado mantido via trigger pra leitura barata.
--
-- RPCs:
-- - submit_open_ended (anon): valida slide ativo, enforce numberOfResponses
--   por participant_fp + slide_id, insert.
-- - toggle_open_ended_vote (anon): insert OR delete em open_ended_votes.
-- - reset_open_ended_slide (authenticated): deleta respostas do slide
--   (owner ou event_member).
-- - get_open_ended_state (anon): respostas ordenadas por created_at desc.

create table public.open_ended_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slide_id uuid not null references public.slides(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  author_name text check (author_name is null or char_length(author_name) between 1 and 60),
  participant_fp text not null,
  vote_count int not null default 0,
  created_at timestamptz not null default now()
);
create index oer_slide_created_idx
  on public.open_ended_responses (slide_id, created_at desc);
create index oer_participant_idx
  on public.open_ended_responses (slide_id, participant_fp);

create table public.open_ended_votes (
  response_id uuid not null references public.open_ended_responses(id) on delete cascade,
  voter_fp text not null,
  created_at timestamptz not null default now(),
  primary key (response_id, voter_fp)
);

-- Realtime
alter publication supabase_realtime add table public.open_ended_responses;
alter publication supabase_realtime add table public.open_ended_votes;
alter table public.open_ended_responses replica identity full;
alter table public.open_ended_votes replica identity full;

-- Trigger pra manter vote_count em sincronia com open_ended_votes.
create or replace function public.open_ended_votes_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.open_ended_responses
      set vote_count = vote_count + 1
      where id = new.response_id;
  elsif tg_op = 'DELETE' then
    update public.open_ended_responses
      set vote_count = greatest(vote_count - 1, 0)
      where id = old.response_id;
  end if;
  return null;
end;
$$;

create trigger open_ended_votes_after_change
  after insert or delete on public.open_ended_votes
  for each row execute function public.open_ended_votes_after_change();

-- RLS: leitura aberta (audiência precisa ver respostas); escrita só via RPC.
alter table public.open_ended_responses enable row level security;
alter table public.open_ended_votes enable row level security;

create policy open_ended_responses_read on public.open_ended_responses
  for select using (true);
create policy open_ended_votes_read on public.open_ended_votes
  for select using (true);

-- submit_open_ended: valida slide ativo + numberOfResponses + insert.
create or replace function public.submit_open_ended(
  p_slug text,
  p_text text,
  p_author_name text,
  p_fp text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_slide_id uuid;
  v_slide public.slides%rowtype;
  v_max int;
  v_count int;
  v_response_id uuid;
  v_number_of_responses jsonb;
begin
  select * into v_event from public.events where slug = p_slug;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  v_slide_id := v_event.active_slide_id;
  if v_slide_id is null then
    raise exception 'no_active_slide' using errcode = 'P0001';
  end if;

  select * into v_slide from public.slides where id = v_slide_id;
  if v_slide.type <> 'open_ended' then
    raise exception 'wrong_slide_type' using errcode = 'P0001';
  end if;

  if p_text is null or char_length(btrim(p_text)) < 1 or char_length(p_text) > 500 then
    raise exception 'text_invalid_length' using errcode = '22000';
  end if;

  if p_fp is null or char_length(p_fp) < 4 then
    raise exception 'fp_invalid' using errcode = '22000';
  end if;

  -- Enforce numberOfResponses. Config: 'unlimited' | 1..5.
  v_number_of_responses := coalesce(v_slide.config -> 'numberOfResponses', '"unlimited"'::jsonb);
  if v_number_of_responses <> '"unlimited"'::jsonb then
    v_max := (v_number_of_responses)::text::int;
    select count(*) into v_count
      from public.open_ended_responses
      where slide_id = v_slide_id and participant_fp = p_fp;
    if v_count >= v_max then
      raise exception 'limit_reached' using errcode = 'P0004';
    end if;
  end if;

  insert into public.open_ended_responses (event_id, slide_id, text, author_name, participant_fp)
    values (v_event.id, v_slide_id, btrim(p_text), nullif(btrim(coalesce(p_author_name, '')), ''), p_fp)
    returning id into v_response_id;

  return jsonb_build_object('ok', true, 'response_id', v_response_id);
end;
$$;

grant execute on function public.submit_open_ended(text, text, text, text) to anon, authenticated;

-- toggle_open_ended_vote: toggle insert/delete.
create or replace function public.toggle_open_ended_vote(
  p_response_id uuid,
  p_fp text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if p_fp is null or char_length(p_fp) < 4 then
    raise exception 'fp_invalid' using errcode = '22000';
  end if;

  select exists(
    select 1 from public.open_ended_votes
      where response_id = p_response_id and voter_fp = p_fp
  ) into v_exists;

  if v_exists then
    delete from public.open_ended_votes
      where response_id = p_response_id and voter_fp = p_fp;
    return jsonb_build_object('voted', false);
  else
    insert into public.open_ended_votes (response_id, voter_fp)
      values (p_response_id, p_fp);
    return jsonb_build_object('voted', true);
  end if;
end;
$$;

grant execute on function public.toggle_open_ended_vote(uuid, text) to anon, authenticated;

-- reset_open_ended_slide: deleta respostas do slide. Auth = owner OR event_member.
create or replace function public.reset_open_ended_slide(p_slide_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_uid uuid;
  v_authorized boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select event_id into v_event_id from public.slides where id = p_slide_id;
  if v_event_id is null then
    raise exception 'slide_not_found' using errcode = 'P0002';
  end if;

  select (
    exists(select 1 from public.events where id = v_event_id and owner_id = v_uid)
    or exists(select 1 from public.event_members where event_id = v_event_id and user_id = v_uid)
  ) into v_authorized;

  if not v_authorized then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  delete from public.open_ended_responses where slide_id = p_slide_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.reset_open_ended_slide(uuid) to authenticated;

-- get_open_ended_state: respostas do slide ordenadas por created_at desc.
create or replace function public.get_open_ended_state(
  p_slug text,
  p_slide_id uuid
)
returns table(
  id uuid,
  text text,
  author_name text,
  vote_count int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.text, r.author_name, r.vote_count, r.created_at
  from public.open_ended_responses r
  join public.events e on e.id = r.event_id
  where e.slug = p_slug and r.slide_id = p_slide_id
  order by r.created_at desc
  limit 200;
$$;

grant execute on function public.get_open_ended_state(text, uuid) to anon, authenticated;
