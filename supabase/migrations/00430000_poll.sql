-- 00430000_poll.sql
--
-- Tipo de slide "poll" (múltipla escolha) com modo quiz opcional (fato/fake).
-- Audiência vota numa opção; telão mostra contagem em barras em tempo real.
-- Operador pode marcar uma opção como "correta" → revelar depois.
--
-- Estrutura:
-- - poll_votes: 1 row por voto (participant_fp + slide_id é chave única).
-- - Sem table separada de "opções" — opções moram em slides.config.options
--   (array de strings) pra simplicidade. Índice no array = identidade do voto.
--
-- RPCs:
-- - submit_poll_vote (anon): valida slide ativo + tipo + índice válido + única
--   por participant_fp; insert ou update se já votou (modo "trocar voto").
-- - get_poll_state (anon): contagem por índice de opção + total.
-- - reset_poll_slide (authenticated): deleta votos do slide.

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slide_id uuid not null references public.slides(id) on delete cascade,
  participant_fp text not null,
  option_index int not null check (option_index >= 0 and option_index < 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um voto por pessoa por slide. Permite "trocar de opinião" via UPDATE,
  -- não permite duplicar votos.
  unique (slide_id, participant_fp)
);
create index pv_slide_idx on public.poll_votes (slide_id, option_index);
create index pv_event_idx on public.poll_votes (event_id);

-- Realtime pra contagens ao vivo no telão.
alter publication supabase_realtime add table public.poll_votes;
alter table public.poll_votes replica identity full;

-- RLS — leitura pública (telão precisa contar), insert/update via RPC.
alter table public.poll_votes enable row level security;
create policy "poll_votes_public_read" on public.poll_votes
  for select using (true);
-- Sem policy de insert/delete direto — só via RPC security definer.

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
  if v_event.submissions_open = false then
    raise exception 'submissions_closed' using errcode = 'P0001';
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

  insert into public.poll_votes (event_id, slide_id, participant_fp, option_index)
  values (v_event.id, p_slide_id, p_participant_fp, p_option_index)
  on conflict (slide_id, participant_fp) do update
    set option_index = excluded.option_index,
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_poll_vote(text, uuid, int, text) to anon, authenticated;

create or replace function public.get_poll_state(
  p_slug text,
  p_slide_id uuid
) returns table (
  option_index int,
  vote_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select e.id into v_event_id from public.events e where e.slug = p_slug;
  if v_event_id is null then
    return;
  end if;
  return query
    select pv.option_index, count(*) as vote_count
      from public.poll_votes pv
     where pv.slide_id = p_slide_id and pv.event_id = v_event_id
     group by pv.option_index
     order by pv.option_index;
end;
$$;

grant execute on function public.get_poll_state(text, uuid) to anon, authenticated;

create or replace function public.reset_poll_slide(p_slide_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.slides where id = p_slide_id;
  if v_event_id is null then
    raise exception 'slide_not_found' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.events e
     where e.id = v_event_id and e.owner_id = auth.uid()
  ) and not exists (
    select 1 from public.event_members m
     where m.event_id = v_event_id and m.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.poll_votes where slide_id = p_slide_id;
end;
$$;

grant execute on function public.reset_poll_slide(uuid) to authenticated;
