-- 00370000_backfill_slides.sql
-- Migra eventos legacy que usavam wordcloud_active/wordcloud_config (1 toggle
-- por evento) pro modelo multi-slide. Cada evento que tinha wordcloud_active
-- ganha 1 slide do tipo 'wordcloud' na position 0, e as palavras existentes
-- são associadas a esse slide.
--
-- IDEMPOTENTE: roda só uma vez (insert filtra eventos que já têm slide).

-- 1. Cria 1 slide wordcloud pra cada evento que tinha wordcloud_active=true
--    e ainda não tem nenhum slide.
insert into public.slides (event_id, type, position, config)
select
  e.id,
  'wordcloud'::public.slide_type,
  0,
  coalesce(e.wordcloud_config, '{}'::jsonb)
from public.events e
where e.wordcloud_active = true
  and not exists (select 1 from public.slides s where s.event_id = e.id);

-- 2. Associa palavras existentes (slide_id null) ao slide recém-criado.
update public.wordcloud_words w
set slide_id = s.id
from public.slides s
where s.event_id = w.event_id
  and s.type = 'wordcloud'
  and s.position = 0
  and w.slide_id is null;

-- 3. Marca o slide como active pra esses eventos.
update public.events e
set active_slide_id = s.id
from public.slides s
where s.event_id = e.id
  and s.position = 0
  and s.type = 'wordcloud'
  and e.wordcloud_active = true
  and e.active_slide_id is null;
