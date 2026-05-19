-- submit_poll_vote checava submissions_open, mas essa flag controla a
-- fila de comentários (submissions table). Polls são votação numa opção,
-- não comentários. Desacopla: poll só valida slide ativo + tipo + índice.
--
-- Sintoma: operador "fechava submissões" pra parar comentários, e
-- audiência clicava Fato/Fake → erro 'submissions_closed'.

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

  -- submissions_open NÃO bloqueia voto em poll. Polls são gated apenas por
  -- "slide ativo" — quando o operador troca de slide, a janela de voto
  -- daquele poll fecha naturalmente.

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
