-- 00340000_wordcloud_rpcs.sql
-- RPCs for the wordcloud interaction.

-- submit_word: anon-friendly insert with rate limit ----------------------
create or replace function public.submit_word(
  p_slug text,
  p_word text,
  p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_recent_count int;
begin
  select * into v_event from public.events where slug = p_slug;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if not v_event.wordcloud_active then
    raise exception 'wordcloud_inactive' using errcode = 'P0001';
  end if;
  if p_word is null or char_length(p_word) < 1 or char_length(p_word) > 30 then
    raise exception 'word_invalid_length' using errcode = '22000';
  end if;

  -- Rate limit: 10 inserts / 60s / ip_hash / event
  select count(*) into v_recent_count
    from public.wordcloud_words
    where event_id = v_event.id
      and ip_hash = p_ip_hash
      and created_at > now() - interval '60 seconds';
  if v_recent_count >= 10 then
    raise exception 'rate_limited' using errcode = 'P0003';
  end if;

  insert into public.wordcloud_words (event_id, word, ip_hash)
    values (v_event.id, p_word, p_ip_hash);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_word(text, text, text) to anon, authenticated;

-- set_wordcloud_active: owner or member -----------------------------------
create or replace function public.set_wordcloud_active(
  p_event_id uuid,
  p_active boolean
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_id = auth.uid()
  ) and not exists (
    select 1 from public.event_members m
    where m.event_id = p_event_id and m.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.events
    set wordcloud_active = p_active
    where id = p_event_id
    returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.set_wordcloud_active(uuid, boolean) to authenticated;
revoke execute on function public.set_wordcloud_active(uuid, boolean) from anon, public;

-- update_wordcloud_config: owner or member --------------------------------
create or replace function public.update_wordcloud_config(
  p_event_id uuid,
  p_config jsonb
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_id = auth.uid()
  ) and not exists (
    select 1 from public.event_members m
    where m.event_id = p_event_id and m.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.events
    set wordcloud_config = p_config
    where id = p_event_id
    returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.update_wordcloud_config(uuid, jsonb) to authenticated;
revoke execute on function public.update_wordcloud_config(uuid, jsonb) from anon, public;

-- get_wordcloud_state: public top-100 aggregation by slug -----------------
create or replace function public.get_wordcloud_state(p_slug text)
returns table(word text, count bigint)
language sql
security definer
set search_path = public
as $$
  select w.word, count(*)::bigint as count
  from public.wordcloud_words w
  join public.events e on e.id = w.event_id
  where e.slug = p_slug
  group by w.word
  order by count desc, w.word asc
  limit 100;
$$;

grant execute on function public.get_wordcloud_state(text) to anon, authenticated;

-- get_wordcloud_settings: public read of toggle + config ------------------
create or replace function public.get_wordcloud_settings(p_slug text)
returns table(event_id uuid, active boolean, config jsonb)
language sql
security definer
set search_path = public
as $$
  select id as event_id, wordcloud_active as active, wordcloud_config as config
  from public.events
  where slug = p_slug
  limit 1;
$$;

grant execute on function public.get_wordcloud_settings(text) to anon, authenticated;

-- reset_wordcloud: owner or member ---------------------------------------
create or replace function public.reset_wordcloud(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_id = auth.uid()
  ) and not exists (
    select 1 from public.event_members m
    where m.event_id = p_event_id and m.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.wordcloud_words where event_id = p_event_id;
end;
$$;

grant execute on function public.reset_wordcloud(uuid) to authenticated;
revoke execute on function public.reset_wordcloud(uuid) from anon, public;
