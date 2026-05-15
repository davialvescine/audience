-- 00380000_slide_rpcs.sql
-- RPCs pra CRUD + activate de slides.

-- create_slide(p_event_id, p_type, p_config) returns slides
-- Auto-positiona no fim da lista. Membership check obrigatório.
create or replace function public.create_slide(
  p_event_id uuid,
  p_type public.slide_type,
  p_config jsonb default '{}'::jsonb
)
returns public.slides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slide public.slides;
  v_next_position int;
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

  select coalesce(max(position) + 1, 0) into v_next_position
    from public.slides
    where event_id = p_event_id;

  insert into public.slides (event_id, type, position, config)
    values (p_event_id, p_type, v_next_position, p_config)
    returning * into v_slide;

  return v_slide;
end;
$$;

grant execute on function public.create_slide(uuid, public.slide_type, jsonb)
  to authenticated;
revoke execute on function public.create_slide(uuid, public.slide_type, jsonb)
  from anon, public;

-- update_slide(p_slide_id, p_config) — atualiza config (com merge no client)
create or replace function public.update_slide(
  p_slide_id uuid,
  p_config jsonb
)
returns public.slides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slide public.slides;
begin
  if not exists (
    select 1
    from public.slides s
    join public.events e on e.id = s.event_id
    where s.id = p_slide_id
      and (
        e.owner_id = auth.uid()
        or exists (
          select 1 from public.event_members m
          where m.event_id = e.id and m.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.slides
    set config = p_config
    where id = p_slide_id
    returning * into v_slide;

  return v_slide;
end;
$$;

grant execute on function public.update_slide(uuid, jsonb) to authenticated;
revoke execute on function public.update_slide(uuid, jsonb) from anon, public;

-- delete_slide(p_slide_id) — remove + reordena positions remanescentes
create or replace function public.delete_slide(p_slide_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_position int;
begin
  select event_id, position into v_event_id, v_position
    from public.slides
    where id = p_slide_id;
  if v_event_id is null then return; end if;

  if not exists (
    select 1 from public.events e
    where e.id = v_event_id and e.owner_id = auth.uid()
  ) and not exists (
    select 1 from public.event_members m
    where m.event_id = v_event_id and m.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.slides where id = p_slide_id;

  -- Reordena: slides com position > deletado descem 1.
  update public.slides
    set position = position - 1
    where event_id = v_event_id and position > v_position;
end;
$$;

grant execute on function public.delete_slide(uuid) to authenticated;
revoke execute on function public.delete_slide(uuid) from anon, public;

-- reorder_slides(p_event_id, p_slide_ids) — atualiza positions baseado no array
create or replace function public.reorder_slides(
  p_event_id uuid,
  p_slide_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_idx int := 0;
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

  -- Constraint é DEFERRABLE; permite reordenar em loop sem bater na unique.
  foreach v_id in array p_slide_ids loop
    update public.slides
      set position = v_idx
      where id = v_id and event_id = p_event_id;
    v_idx := v_idx + 1;
  end loop;
end;
$$;

grant execute on function public.reorder_slides(uuid, uuid[]) to authenticated;
revoke execute on function public.reorder_slides(uuid, uuid[]) from anon, public;

-- set_active_slide(p_event_id, p_slide_id) — slide null pausa apresentação
create or replace function public.set_active_slide(
  p_event_id uuid,
  p_slide_id uuid
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
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

  if p_slide_id is not null and not exists (
    select 1 from public.slides s
    where s.id = p_slide_id and s.event_id = p_event_id
  ) then
    raise exception 'slide_not_in_event' using errcode = 'P0001';
  end if;

  update public.events
    set active_slide_id = p_slide_id
    where id = p_event_id
    returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.set_active_slide(uuid, uuid) to authenticated;
revoke execute on function public.set_active_slide(uuid, uuid) from anon, public;

-- get_active_slide(p_slug) — pública (audiência + telão consultam)
create or replace function public.get_active_slide(p_slug text)
returns table(
  slide_id uuid,
  slide_type public.slide_type,
  config jsonb,
  event_id uuid,
  event_name text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.type, s.config, e.id, e.name
  from public.events e
  left join public.slides s on s.id = e.active_slide_id
  where e.slug = p_slug;
$$;

grant execute on function public.get_active_slide(text) to anon, authenticated;

-- list_slides(p_event_id) — owner/member
create or replace function public.list_slides(p_event_id uuid)
returns setof public.slides
language sql
security definer
set search_path = public
as $$
  select s.*
  from public.slides s
  where s.event_id = p_event_id
  order by s.position asc;
$$;

grant execute on function public.list_slides(uuid) to authenticated;
