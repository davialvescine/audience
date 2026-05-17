-- 00420100_backfill_comments_slide.sql
-- Para cada evento sem slide do tipo 'comments', cria um snapshot do
-- events.telao_config como slide. Se o evento não tinha active_slide_id,
-- marca o novo slide como ativo — assim /telao/<slug> continua renderizando
-- exatamente como antes da feature (cards rotativos da fila de moderação).
--
-- Idempotente: where not exists garante que rodar 2x não duplica.

do $$
declare
  ev record;
  new_slide_id uuid;
  next_pos int;
begin
  for ev in
    select e.id as event_id, e.telao_config, e.active_slide_id
      from public.events e
     where not exists (
       select 1 from public.slides s
        where s.event_id = e.id and s.type = 'comments'
     )
  loop
    select coalesce(max(position), -1) + 1
      into next_pos
      from public.slides
     where event_id = ev.event_id;

    insert into public.slides (event_id, type, position, config)
    values (
      ev.event_id,
      'comments'::public.slide_type,
      next_pos,
      coalesce(ev.telao_config, '{}'::jsonb)
        || jsonb_build_object('showTitle', false)
    )
    returning id into new_slide_id;

    if ev.active_slide_id is null then
      update public.events
         set active_slide_id = new_slide_id
       where id = ev.event_id;
    end if;
  end loop;
end $$;
