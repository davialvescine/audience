-- Reduz max da palavra de 30 → 25 caracteres no submit_word.
-- Palavras curtas = nuvem mais legível e contagem mais robusta
-- (gente escrevia frases inteiras antes).

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
  v_active_slide_id uuid;
  v_slide_type slide_type;
  v_recent_count int;
begin
  select * into v_event from public.events where slug = p_slug;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
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

  -- Era 30, agora 25 — força palavras mais curtas na nuvem.
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

  insert into public.wordcloud_words (event_id, slide_id, word, ip_hash)
    values (v_event.id, v_active_slide_id, p_word, p_ip_hash);

  return jsonb_build_object('ok', true, 'slide_id', v_active_slide_id);
end;
$$;
