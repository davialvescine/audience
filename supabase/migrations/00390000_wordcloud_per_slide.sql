-- 00390000_wordcloud_per_slide.sql
--
-- Cada slide é uma pergunta independente — palavras devem ser escopadas
-- por slide, não por evento. Antes desta migration, todas as palavras do
-- evento apareciam em qualquer slide ativo (sem lógica).
--
-- Mudanças:
-- 1. wordcloud_words.slide_id (nullable inicialmente pra backfill suave).
-- 2. submit_word resolve slide_id automaticamente via events.active_slide_id.
-- 3. get_wordcloud_state aceita slide_id opcional pra filtrar.

alter table public.wordcloud_words
  add column if not exists slide_id uuid references public.slides(id) on delete cascade;

create index if not exists wordcloud_words_slide_idx
  on public.wordcloud_words (slide_id, created_at desc);

-- submit_word agora deriva o slide_id do events.active_slide_id no momento
-- do envio. Se não houver slide ativo, mantém compat com legacy via
-- events.wordcloud_active.
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

  -- Resolve slide ativo (pode ser null em eventos legacy).
  v_active_slide_id := v_event.active_slide_id;
  if v_active_slide_id is not null then
    select type into v_slide_type from public.slides where id = v_active_slide_id;
    if v_slide_type is null or v_slide_type <> 'wordcloud' then
      -- Slide ativo não é wordcloud (ex: poll) — submissão de palavra inválida.
      raise exception 'wordcloud_inactive' using errcode = 'P0001';
    end if;
  else
    -- Sem slide ativo: só permite via flag legacy.
    if not v_event.wordcloud_active then
      raise exception 'wordcloud_inactive' using errcode = 'P0001';
    end if;
  end if;

  if p_word is null or char_length(p_word) < 1 or char_length(p_word) > 30 then
    raise exception 'word_invalid_length' using errcode = '22000';
  end if;

  -- Rate limit: 10 / 60s / ip / event (mesma janela, vale entre slides
  -- pra evitar flood movendo entre slides rapidamente).
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

-- get_wordcloud_state aceita slide_id opcional. Quando passado, filtra por
-- slide. Sem slide_id, retorna agregado por evento (compat legacy).
drop function if exists public.get_wordcloud_state(text);

create or replace function public.get_wordcloud_state(
  p_slug text,
  p_slide_id uuid default null
)
returns table(word text, count bigint)
language sql
security definer
set search_path = public
as $$
  select w.word, count(*)::bigint as count
  from public.wordcloud_words w
  join public.events e on e.id = w.event_id
  where e.slug = p_slug
    and (p_slide_id is null or w.slide_id = p_slide_id)
  group by w.word
  order by count desc, w.word asc
  limit 100;
$$;

grant execute on function public.get_wordcloud_state(text, uuid) to anon, authenticated;
