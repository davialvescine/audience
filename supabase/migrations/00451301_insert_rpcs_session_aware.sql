-- F5: recria as 4 RPCs de INSERT pra carimbar events.active_session_id no
-- novo campo session_id. Sem isso, dados novos ficariam com session_id NULL
-- e violariam o NOT NULL constraint da 00451300.

-- ----- submit_comment -----------------------------------------------------
create or replace function public.submit_comment(
  p_slug text,
  p_name text,
  p_comment text,
  p_ip_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_open boolean;
  v_session_id uuid;
  v_count int;
  v_submission_id uuid;
  v_name text;
begin
  select id, submissions_open, active_session_id
    into v_event_id, v_open, v_session_id
  from public.events where slug = p_slug;

  if v_event_id is null then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;
  if not v_open then
    raise exception 'submissions_closed' using errcode = 'P0001';
  end if;
  if v_session_id is null then
    raise exception 'no_active_session' using errcode = 'P0001';
  end if;

  v_name := coalesce(nullif(btrim(p_name), ''), 'Anônimo');
  if char_length(v_name) > 60 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_comment, '')) < 1 or char_length(p_comment) > 150 then
    raise exception 'invalid_comment' using errcode = 'P0001';
  end if;

  if p_ip_hash is not null then
    select count(*) into v_count
    from public.submissions
    where event_id = v_event_id
      and ip_hash = p_ip_hash
      and created_at > now() - interval '60 seconds';
    if v_count >= 5 then
      raise exception 'rate_limited' using errcode = 'P0003';
    end if;
  end if;

  insert into public.submissions (event_id, session_id, name, comment, ip_hash, status)
  values (v_event_id, v_session_id, v_name, p_comment, p_ip_hash, 'pending')
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

-- ----- submit_word --------------------------------------------------------
create or replace function public.submit_word(
  p_slug text,
  p_word text,
  p_ip_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_active_slide_id uuid;
  v_slide_type slide_type;
  v_recent_count int;
begin
  select * into v_event from public.events where slug = p_slug;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if v_event.active_session_id is null then
    raise exception 'no_active_session' using errcode = 'P0001';
  end if;

  v_active_slide_id := v_event.active_slide_id;
  if v_active_slide_id is not null then
    select type into v_slide_type from public.slides where id = v_active_slide_id;
    if v_slide_type is null or v_slide_type <> 'wordcloud' then
      raise exception 'wordcloud_inactive' using errcode = 'P0001';
    end if;
  else
    if not v_event.wordcloud_active then
      raise exception 'wordcloud_inactive' using errcode = 'P0001';
    end if;
  end if;

  if p_word is null or char_length(p_word) < 1 or char_length(p_word) > 25 then
    raise exception 'word_invalid_length' using errcode = '22000';
  end if;

  select count(*) into v_recent_count
    from public.wordcloud_words
    where event_id = v_event.id
      and ip_hash = p_ip_hash
      and created_at > now() - interval '60 seconds';
  if v_recent_count >= 10 then
    raise exception 'rate_limited' using errcode = 'P0003';
  end if;

  insert into public.wordcloud_words (event_id, session_id, slide_id, word, ip_hash)
    values (v_event.id, v_event.active_session_id, v_active_slide_id, p_word, p_ip_hash);

  return jsonb_build_object('ok', true, 'slide_id', v_active_slide_id);
end;
$$;

-- ----- submit_poll_vote ---------------------------------------------------
create or replace function public.submit_poll_vote(
  p_slug text,
  p_slide_id uuid,
  p_option_index int,
  p_participant_fp text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_slide public.slides;
begin
  if p_participant_fp is null or length(p_participant_fp) < 8 then
    raise exception 'invalid_fingerprint' using errcode = 'P0001';
  end if;
  if p_option_index < 0 or p_option_index >= 50 then
    raise exception 'invalid_option' using errcode = 'P0001';
  end if;

  select * into v_event from public.events where slug = p_slug;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;
  if v_event.active_session_id is null then
    raise exception 'no_active_session' using errcode = 'P0001';
  end if;

  select * into v_slide from public.slides
    where id = p_slide_id and event_id = v_event.id;
  if not found then
    raise exception 'slide_not_in_event' using errcode = 'P0001';
  end if;
  if v_slide.type <> 'poll' then
    raise exception 'wrong_slide_type' using errcode = 'P0001';
  end if;
  if v_slide.id <> v_event.active_slide_id then
    raise exception 'slide_not_active' using errcode = 'P0001';
  end if;

  insert into public.poll_votes (event_id, session_id, slide_id, participant_fp, option_index)
  values (v_event.id, v_event.active_session_id, p_slide_id, p_participant_fp, p_option_index)
  on conflict (slide_id, participant_fp) do update
    set option_index = excluded.option_index,
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- ----- submit_open_ended --------------------------------------------------
create or replace function public.submit_open_ended(
  p_slug text,
  p_text text,
  p_author_name text,
  p_fp text
) returns jsonb
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
  if v_event.active_session_id is null then
    raise exception 'no_active_session' using errcode = 'P0001';
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

  v_number_of_responses := coalesce(v_slide.config -> 'numberOfResponses', '"unlimited"'::jsonb);
  if v_number_of_responses <> '"unlimited"'::jsonb then
    v_max := (v_number_of_responses)::text::int;
    select count(*) into v_count
      from public.open_ended_responses
      where slide_id = v_slide_id and participant_fp = p_fp
        and session_id = v_event.active_session_id;
    if v_count >= v_max then
      raise exception 'limit_reached' using errcode = 'P0004';
    end if;
  end if;

  insert into public.open_ended_responses (event_id, session_id, slide_id, text, author_name, participant_fp)
    values (
      v_event.id,
      v_event.active_session_id,
      v_slide_id,
      btrim(p_text),
      nullif(btrim(coalesce(p_author_name, '')), ''),
      p_fp
    )
    returning id into v_response_id;

  return jsonb_build_object('ok', true, 'response_id', v_response_id);
end;
$$;
