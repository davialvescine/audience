-- F5: recria as RPCs de READ pra filtrar por events.active_session_id.
-- Sem isso, telão/moderador mostrariam dados de TODAS as sessões.

-- ----- get_telao_submissions_since ---------------------------------------
create or replace function public.get_telao_submissions_since(
  p_slug text,
  p_since timestamptz
) returns table (
  id uuid,
  name text,
  comment text,
  created_at timestamptz,
  sent_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.name, s.comment, s.created_at, s.sent_at
  from public.submissions s
  join public.events e on e.id = s.event_id
  where e.slug = p_slug
    and s.session_id = e.active_session_id
    and s.status = 'sent'
    and (p_since is null or s.sent_at > p_since)
  order by s.sent_at asc
  limit 50;
$$;

-- ----- get_pinned_submission --------------------------------------------
create or replace function public.get_pinned_submission(p_slug text)
returns table (id uuid, name text, comment text, sent_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.name, s.comment, s.sent_at
  from public.submissions s
  join public.events e on e.id = s.event_id
  where e.slug = p_slug
    and e.pinned_submission_id = s.id
    and s.session_id = e.active_session_id;
$$;

-- ----- get_pinned_via_token ---------------------------------------------
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
  v_active_session uuid;
begin
  v_event_id := public.validate_moderator_token(p_token);
  if v_event_id is null then return; end if;

  select pinned_submission_id, active_session_id into v_pinned, v_active_session
    from public.events where id = v_event_id;
  if v_pinned is null or v_active_session is null then return; end if;

  return query
    select s.id, s.name, s.comment, s.sent_at
      from public.submissions s
     where s.id = v_pinned
       and s.session_id = v_active_session;
end;
$$;

-- ----- get_submissions_via_token ----------------------------------------
create or replace function public.get_submissions_via_token(
  p_token text,
  p_status_filter text default null
) returns table (
  id uuid,
  name text,
  comment text,
  status submission_status,
  created_at timestamptz,
  error_message text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_event_id uuid;
  v_active_session uuid;
begin
  v_event_id := public.validate_moderator_token(p_token);
  if v_event_id is null then
    raise exception 'invalid_token' using errcode = '42501';
  end if;

  select active_session_id into v_active_session from public.events where id = v_event_id;
  if v_active_session is null then return; end if;

  return query
    select s.id, s.name, s.comment, s.status, s.created_at, s.error_message
    from public.submissions s
    where s.event_id = v_event_id
      and s.session_id = v_active_session
      and (p_status_filter is null or s.status::text = p_status_filter)
    order by s.created_at desc
    limit 200;
end;
$$;

-- ----- count_event_sent_submissions -------------------------------------
create or replace function public.count_event_sent_submissions(p_slug text)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint
    from public.submissions s
    join public.events e on e.id = s.event_id
   where e.slug = p_slug
     and s.session_id = e.active_session_id
     and s.status = 'sent';
$$;

-- ----- get_wordcloud_state ----------------------------------------------
create or replace function public.get_wordcloud_state(
  p_slug text,
  p_slide_id uuid default null
) returns table(word text, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select w.word, count(*)::bigint as count
  from public.wordcloud_words w
  join public.events e on e.id = w.event_id
  where e.slug = p_slug
    and w.session_id = e.active_session_id
    and (p_slide_id is null or w.slide_id = p_slide_id)
  group by w.word
  order by count desc, w.word asc
  limit 100;
$$;

-- ----- get_poll_state ---------------------------------------------------
create or replace function public.get_poll_state(
  p_slug text,
  p_slide_id uuid
) returns table (
  option_index int,
  vote_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_event_id uuid;
  v_active_session uuid;
begin
  select e.id, e.active_session_id into v_event_id, v_active_session
    from public.events e where e.slug = p_slug;
  if v_event_id is null or v_active_session is null then
    return;
  end if;
  return query
    select pv.option_index, count(*) as vote_count
      from public.poll_votes pv
     where pv.event_id = v_event_id
       and pv.session_id = v_active_session
       and pv.slide_id = p_slide_id
     group by pv.option_index
     order by pv.option_index;
end;
$$;

-- ----- get_open_ended_state ---------------------------------------------
create or replace function public.get_open_ended_state(
  p_slug text,
  p_slide_id uuid
) returns table(
  id uuid,
  text text,
  author_name text,
  vote_count int,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select r.id, r.text, r.author_name, r.vote_count, r.created_at
  from public.open_ended_responses r
  join public.events e on e.id = r.event_id
  where e.slug = p_slug
    and r.session_id = e.active_session_id
    and r.slide_id = p_slide_id
  order by r.created_at desc
  limit 200;
$$;
